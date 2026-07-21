import { getDocumentGenerationPluginDefinitions } from '../../core/integrations/plugins/PluginRegistry';
import {
  createDocumentGenerationAdapter,
  resolveDefaultDocumentGenerationCode,
} from '../../core/integrations/document-generation/DocumentGenerationRegistry';
import { getFeatureGateCached } from '../../core/db/repos/featureRepo';
import { isFeatureAvailable } from '../../core/services/featureAvailabilityService';
import {
  DocumentGenerationMode,
  DocumentGenerationOutcome,
  FeatureAvailability,
  Permissions,
} from '../../core/db/codes';
import {
  getSubmissionListContext,
  getSubmissionRecordById,
  type SubmissionRecord,
} from '../../core/db/repos/submissionRepo';
import { hasFormSubmitAccess, type CallerIdentity } from '../../core/db/repos/formSubmitAccessRepo';
import { createDocumentGenerationAudit } from '../../core/db/repos/documentGenerationAuditRepo';
import { SubmissionService } from '../../core/services/submissionService';
import { AppError } from '../../core/errors';
import { log, getCorrelationId } from '../../core/logging';

// Opaque CDOGS payload parts, passed through to the backend adapter as { template, options, data }.
type PayloadObject = Record<string, unknown>;

export interface PreviewInput {
  submissionId: string;
  template: PayloadObject;
  options?: PayloadObject;
  /** Live, on-screen answer data supplied by the caller (not read from the persisted submission). */
  data: PayloadObject;
}

export interface PrintInput {
  submissionId: string;
  template: PayloadObject;
  options?: PayloadObject;
}

export type DocumentRenderOutcome =
  | { status: 'ok'; code: string; data: Buffer; contentType?: string }
  | { status: 'error'; code: string; error: unknown }
  | { status: 'notfound' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'no-content' };

interface ResolvedScope {
  workspaceId: string;
  formId: string;
}

interface AuditContext {
  mode: string;
  caller: CallerIdentity;
  submissionId: string;
}

const submissionReader = new SubmissionService();

// PI-safe: record the error class only (e.g. ServiceUnavailableError), never the upstream error
// body, which can echo submitted answer data. The mapped HTTP status is captured separately.
const errorLabel = (err: unknown): string => (err instanceof Error ? err.name : 'Error');

/**
 * Record one document-generation backend call (success or error). Non-blocking: a failed audit write
 * is logged and swallowed so it never fails the render. Skips when there is no actor to attribute.
 */
async function recordAudit(params: {
  audit: AuditContext;
  scope: ResolvedScope;
  backendCode: string;
  outcome: string;
  durationMs: number;
  httpStatus?: number | null;
  errorDetail?: string | null;
}): Promise<void> {
  const createdBy = params.audit.caller.actorId;
  if (!createdBy) {
    // Shouldn't happen on the submit surface (public user always resolves an actor); flag if it does.
    log.warn(
      { mode: params.audit.mode },
      'skipping document-generation audit: no actor to attribute',
    );
    return;
  }
  try {
    await createDocumentGenerationAudit({
      workspaceId: params.scope.workspaceId,
      formId: params.scope.formId,
      submissionId: params.audit.submissionId,
      mode: params.audit.mode,
      backendCode: params.backendCode,
      outcome: params.outcome,
      httpStatus: params.httpStatus,
      durationMs: params.durationMs,
      errorDetail: params.errorDetail,
      requestId: getCorrelationId() ?? null,
      createdBy,
    });
  } catch (err) {
    log.error({ err }, 'failed to write document-generation audit');
  }
}

/**
 * Pick the document-generation backend for a scope: a granted scoped backend (e.g. cdogs-v3)
 * overrides the configured default; otherwise the default, if its own feature (when it has one) is
 * available. Null when nothing is available.
 */
async function resolveBackendCode(scope: ResolvedScope): Promise<string | null> {
  const definitions = getDocumentGenerationPluginDefinitions();
  const defaultCode = resolveDefaultDocumentGenerationCode();

  // A granted scoped backend overrides the default. With more than one scoped backend the first in
  // registration order wins — add an explicit priority before a second scoped backend is installed.
  for (const def of definitions) {
    if (def.code === defaultCode || !def.featureCode) continue;
    const gate = await getFeatureGateCached(def.featureCode, Date.now());
    const isScopedBackend = gate?.availability === FeatureAvailability.scoped;
    if (isScopedBackend && (await isFeatureAvailable(def.featureCode, scope))) {
      return def.code;
    }
  }

  // Fall back to the configured default — but only if it is actually installed, so a stale/typo'd
  // DOCUMENT_GENERATION_DEFAULT_CODE surfaces as unavailable rather than an adapter-lookup 500.
  const defaultDef = definitions.find((d) => d.code === defaultCode);
  if (!defaultDef) return null;
  if (!defaultDef.featureCode || (await isFeatureAvailable(defaultDef.featureCode, scope))) {
    return defaultCode;
  }
  return null;
}

async function renderWith(
  scope: ResolvedScope,
  body: { template: PayloadObject; options?: PayloadObject; data: PayloadObject },
  audit: AuditContext,
): Promise<DocumentRenderOutcome> {
  const code = await resolveBackendCode(scope);
  if (!code) return { status: 'unavailable' };

  // The audit boundary is the backend call itself: one row per invocation, success or error.
  const adapter = createDocumentGenerationAdapter(code);
  const startedAt = Date.now();
  try {
    const result = await adapter.render({
      template: body.template,
      options: body.options ?? {},
      data: body.data,
    });
    await recordAudit({
      audit,
      scope,
      backendCode: code,
      outcome: DocumentGenerationOutcome.success,
      durationMs: Date.now() - startedAt,
    });
    return { status: 'ok', code, data: result.data, contentType: result.contentType };
  } catch (err) {
    await recordAudit({
      audit,
      scope,
      backendCode: code,
      outcome: DocumentGenerationOutcome.error,
      durationMs: Date.now() - startedAt,
      httpStatus: err instanceof AppError ? err.statusCode : null,
      errorDetail: errorLabel(err),
    });
    return { status: 'error', code, error: err };
  }
}

/**
 * Print access: `submission_read` (staff, or a public/idp audience where submissions are public data),
 * or the submitter printing their own submission. The owner branch is load-bearing for a user-member
 * submitter, who holds `submission_create` but not `submission_read`; requiring `submission_create`
 * there bounds the shared public-user id to forms the caller can submit to.
 */
async function canPrint(
  workspaceId: string,
  caller: CallerIdentity,
  record: SubmissionRecord,
): Promise<boolean> {
  if (await hasFormSubmitAccess(workspaceId, caller, Permissions.submission_read)) return true;
  return (
    !!caller.actorId &&
    record.submittedBy === caller.actorId &&
    (await hasFormSubmitAccess(workspaceId, caller, Permissions.submission_create))
  );
}

export const documentGenerationService = {
  /** Render from the caller's live (on-screen) data. The submission is only the authorization anchor. */
  async preview(caller: CallerIdentity, input: PreviewInput): Promise<DocumentRenderOutcome> {
    const scope = await getSubmissionListContext(input.submissionId);
    if (!scope) return { status: 'notfound' };
    const allowed = await hasFormSubmitAccess(
      scope.workspaceId,
      caller,
      Permissions.submission_create,
    );
    if (!allowed) return { status: 'denied' };
    return renderWith(
      scope,
      { template: input.template, options: input.options, data: input.data },
      { mode: DocumentGenerationMode.preview, caller, submissionId: input.submissionId },
    );
  },

  /** Render from the submission's persisted answer data (read from the form engine). */
  async print(caller: CallerIdentity, input: PrintInput): Promise<DocumentRenderOutcome> {
    const scope = await getSubmissionListContext(input.submissionId);
    if (!scope) return { status: 'notfound' };
    const record = await getSubmissionRecordById(scope.workspaceId, input.submissionId);
    if (!record) return { status: 'notfound' };
    if (!(await canPrint(scope.workspaceId, caller, record))) return { status: 'denied' };

    // Persisted answer data as returned by the engine. The exact merge shape (unwrapping/metadata)
    // is a template-contract detail to finalize with stored templates. Pass the record we already
    // loaded so getContent doesn't re-read it.
    const data = await submissionReader.getContent({
      workspaceId: scope.workspaceId,
      submissionId: input.submissionId,
      record,
    });
    if (!data) return { status: 'no-content' };

    return renderWith(
      scope,
      { template: input.template, options: input.options, data },
      { mode: DocumentGenerationMode.print, caller, submissionId: input.submissionId },
    );
  },
};
