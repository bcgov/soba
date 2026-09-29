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
} from '../../core/db/codes';
import {
  getSubmissionListContext,
  getSubmissionRecordById,
} from '../../core/db/repos/submissionRepo';
import type { CallerIdentity } from '../../core/db/repos/formSubmitAccessRepo';
import { isSubmitterAllowed, SubmitterOperation } from '../../core/services/submitterAccess';
import { createDocumentGenerationAudit } from '../../core/db/repos/documentGenerationAuditRepo';
import {
  getLiveDocumentTemplate,
  listLiveDocumentTemplates,
  type DocumentTemplateWithFile,
} from '../../core/db/repos/documentTemplateRepo';
import { SubmissionService } from '../../core/services/submissionService';
import type { DocumentRenderRequest } from '../../core/integrations/document-generation/DocumentGenerationAdapter';
import { templateFileType } from '../../core/integrations/document-generation/templateFileType';
import { upstreamStatusOf } from '../../core/http/httpErrorMapper';
import { env } from '../../core/config/env';
import { AppError, UnprocessableEntityError } from '../../core/errors';
import { log, getCorrelationId } from '../../core/logging';
import { readTemplateContent } from './templateContent';
import { TEMPLATE_NOT_RENDERED, toRenderError } from './renderError';
import { withRenderSlot } from './renderSlots';

// Backend-specific parts of the request, passed through to the adapter.
type PayloadObject = Record<string, unknown>;

export interface PreviewInput {
  submissionId: string;
  templateId: string;
  options?: PayloadObject;
  /** Live, on-screen answer data supplied by the caller (not read from the persisted submission). */
  data: PayloadObject;
}

export interface PrintInput {
  submissionId: string;
  templateId: string;
  options?: PayloadObject;
}

export type DocumentRenderOutcome =
  | { status: 'ok'; code: string; data: Buffer; contentType?: string }
  | { status: 'error'; code: string; error: unknown }
  | { status: 'notfound' }
  | { status: 'template-notfound' }
  | { status: 'template-unavailable' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'busy' }
  | { status: 'no-content' };

export type TemplateListOutcome =
  | { status: 'ok'; templates: { id: string; name: string }[] }
  | { status: 'notfound' }
  | { status: 'denied' };

interface ResolvedScope {
  workspaceId: string;
  formId: string;
  formVersionId: string;
}

interface AuditContext {
  mode: string;
  caller: CallerIdentity;
  submissionId: string;
}

const submissionReader = new SubmissionService();
const maxConcurrentRenders = env.getDocumentGenerationMaxConcurrent();

// PI-safe: record the error class and the upstream status (e.g. `ServiceUnavailableError
// upstream 429`), never the upstream error body, which can echo submitted answer data. The mapped
// HTTP status is captured separately.
const errorLabel = (err: unknown): string => {
  const label = err instanceof Error ? err.name : 'Error';
  const upstream = upstreamStatusOf(err);
  return upstream === undefined ? label : `${label} upstream ${upstream}`;
};

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

/** The submission's scope, when it exists and the caller may render documents from it. */
async function renderScope(
  caller: CallerIdentity,
  submissionId: string,
): Promise<ResolvedScope | 'notfound' | 'denied'> {
  const scope = await getSubmissionListContext(submissionId);
  if (!scope) return 'notfound';
  const target = { ...scope, submissionId };
  if (!(await isSubmitterAllowed(SubmitterOperation.render, target, caller))) return 'denied';
  return scope;
}

/** Call the backend once, audited: one row per call, success or error. */
async function callBackend(
  code: string,
  scope: ResolvedScope,
  request: DocumentRenderRequest,
  audit: AuditContext,
  templateId: string,
): Promise<DocumentRenderOutcome> {
  // Adapter construction, which validates config, is inside the audit boundary.
  const startedAt = Date.now();
  try {
    // Backend-agnostic: backend-specific shaping (base64 template, data flatten, CDOGS overwrite)
    // lives in the plugin.
    const result = await createDocumentGenerationAdapter(code).render(request);
    await recordAudit({
      audit,
      scope,
      backendCode: code,
      outcome: DocumentGenerationOutcome.success,
      durationMs: Date.now() - startedAt,
    });
    return { status: 'ok', code, data: result.data, contentType: result.contentType };
  } catch (err) {
    const error = toRenderError(err, { code, templateId });
    // The audit keeps the backend's mapped status and class; the caller gets the generic error.
    const audited = err instanceof AppError ? err : error;
    await recordAudit({
      audit,
      scope,
      backendCode: code,
      outcome: DocumentGenerationOutcome.error,
      durationMs: Date.now() - startedAt,
      httpStatus: audited.statusCode,
      errorDetail: errorLabel(audited),
    });
    return { status: 'error', code, error };
  }
}

/** Render the template with the answer data: backend, then the template bytes, then the call. */
async function renderWith(
  scope: ResolvedScope,
  stored: DocumentTemplateWithFile,
  body: { options?: PayloadObject; data: PayloadObject },
  audit: AuditContext,
): Promise<DocumentRenderOutcome> {
  const code = await resolveBackendCode(scope);
  if (!code) return { status: 'unavailable' };

  const templateId = stored.template.id;
  const { id: fileId, profile, filename, size } = stored.file;
  const maxBytes = env.getTemplatesMaxFileSizeMb() * 1024 * 1024;
  const fileType = templateFileType(filename);
  if (!fileType || (size ?? 0) > maxBytes) {
    const reason = fileType ? 'exceeds the template size limit' : 'not a template file type';
    log.warn({ templateId, fileId, profile, reason }, 'Stored template is not renderable');
    return { status: 'error', code, error: new UnprocessableEntityError(TEMPLATE_NOT_RENDERED) };
  }

  const rendered = await withRenderSlot(
    maxConcurrentRenders,
    async (): Promise<DocumentRenderOutcome> => {
      const content = await readTemplateContent(stored, maxBytes);
      if (!content) return { status: 'template-unavailable' };
      return callBackend(
        code,
        scope,
        { template: { content, fileType }, options: body.options ?? {}, data: body.data },
        audit,
        templateId,
      );
    },
  );
  return rendered === 'busy' ? { status: 'busy' } : rendered;
}

export const documentGenerationService = {
  /** The templates the caller may render from the submission: those on its form version. */
  async listTemplates(caller: CallerIdentity, submissionId: string): Promise<TemplateListOutcome> {
    const scope = await renderScope(caller, submissionId);
    if (scope === 'notfound' || scope === 'denied') return { status: scope };
    const templates = await listLiveDocumentTemplates(scope.formVersionId);
    return {
      status: 'ok',
      templates: templates.map(({ template }) => ({ id: template.id, name: template.name })),
    };
  },

  /** Render from the caller's live (on-screen) data. The submission is only the authorization anchor. */
  async preview(caller: CallerIdentity, input: PreviewInput): Promise<DocumentRenderOutcome> {
    const scope = await renderScope(caller, input.submissionId);
    if (scope === 'notfound' || scope === 'denied') return { status: scope };
    const stored = await getLiveDocumentTemplate(input.templateId, scope.formVersionId);
    if (!stored) return { status: 'template-notfound' };
    return renderWith(
      scope,
      stored,
      { options: input.options, data: input.data },
      { mode: DocumentGenerationMode.preview, caller, submissionId: input.submissionId },
    );
  },

  /** Render from the submission's persisted answer data (read from the form engine). */
  async print(caller: CallerIdentity, input: PrintInput): Promise<DocumentRenderOutcome> {
    const scope = await renderScope(caller, input.submissionId);
    if (scope === 'notfound' || scope === 'denied') return { status: scope };
    const record = await getSubmissionRecordById(scope.workspaceId, input.submissionId);
    if (!record) return { status: 'notfound' };
    const stored = await getLiveDocumentTemplate(input.templateId, scope.formVersionId);
    if (!stored) return { status: 'template-notfound' };

    // Persisted answer document from the engine (the plugin shapes it for the template). Pass the
    // record we already loaded so getContent doesn't re-read it.
    const data = await submissionReader.getContent({
      workspaceId: scope.workspaceId,
      submissionId: input.submissionId,
      record,
    });
    if (!data) return { status: 'no-content' };

    return renderWith(
      scope,
      stored,
      { options: input.options, data },
      { mode: DocumentGenerationMode.print, caller, submissionId: input.submissionId },
    );
  },
};
