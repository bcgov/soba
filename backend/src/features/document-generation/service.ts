import { getDocumentGenerationPluginDefinitions } from '../../core/integrations/plugins/PluginRegistry';
import {
  createDocumentGenerationAdapter,
  resolveDefaultDocumentGenerationCode,
} from '../../core/integrations/document-generation/DocumentGenerationRegistry';
import { getFeatureGateCached } from '../../core/db/repos/featureRepo';
import { isFeatureAvailable } from '../../core/services/featureAvailabilityService';
import { FeatureAvailability, Permissions } from '../../core/db/codes';
import {
  getSubmissionListContext,
  getSubmissionRecordById,
  type SubmissionRecord,
} from '../../core/db/repos/submissionRepo';
import { hasFormSubmitAccess, type CallerIdentity } from '../../core/db/repos/formSubmitAccessRepo';
import { SubmissionService } from '../../core/services/submissionService';

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
  | { status: 'notfound' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'no-content' };

interface ResolvedScope {
  workspaceId: string;
  formId: string;
}

const submissionReader = new SubmissionService();

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
): Promise<DocumentRenderOutcome> {
  const code = await resolveBackendCode(scope);
  if (!code) return { status: 'unavailable' };

  const adapter = createDocumentGenerationAdapter(code);
  const result = await adapter.render({
    template: body.template,
    options: body.options ?? {},
    data: body.data,
  });
  return { status: 'ok', code, data: result.data, contentType: result.contentType };
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
    return renderWith(scope, {
      template: input.template,
      options: input.options,
      data: input.data,
    });
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

    return renderWith(scope, { template: input.template, options: input.options, data });
  },
};
