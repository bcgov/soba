import type { Logger } from 'pino';
import { validate as isUuid } from 'uuid';
import { getFormEngineCodeForForm } from '../../core/db/repos/formRepo';
import { getFormVersionById } from '../../core/db/repos/formVersionRepo';
import {
  findSubmissionRevisionContent,
  findSubmittedRevisionNo,
} from '../../core/db/repos/submissionRepo';
import type {
  PostSubmissionActionResult,
  PostSubmissionActionServices,
  PostSubmissionActionSubmission,
  PostSubmissionActionUpload,
} from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { getTempStorageAdapter } from '../../core/integrations/plugins/PluginRegistry';
import type { JobFacts } from '../../core/jobs/facts';
import type { JobContext } from '../../core/jobs/registry';
import { SubmissionService } from '../../core/services/submissionService';
import { jobDocumentService } from '../document-generation/service';
import { filesService } from '../files/service';
import { actionNotifications, systemUserId } from './notifications';
import { readFromEngine, toRenderOutcome, toUpload } from './serviceOutcomes';

const submissionReader = new SubmissionService();

/** The answers a revision of the submission left, from the form's engine. */
const readRevision = async (
  submission: PostSubmissionActionSubmission,
  revisionId: string,
  log: Logger,
): Promise<Record<string, unknown> | null> => {
  if (!isUuid(revisionId)) return null;
  const engineSubmissionRef = await findSubmissionRevisionContent(
    submission.workspaceId,
    submission.id,
    revisionId,
  );
  if (!engineSubmissionRef) return null;
  const [version, engineCode] = await Promise.all([
    getFormVersionById(submission.workspaceId, submission.formVersionId),
    getFormEngineCodeForForm(submission.workspaceId, submission.formId),
  ]);
  if (!version?.engineSchemaRef || !engineCode) return null;
  const engineSchemaRef = version.engineSchemaRef;
  return readFromEngine(
    () => submissionReader.readContent({ engineCode, engineSchemaRef, engineSubmissionRef }),
    log,
  );
};

/** A file uploaded to the submission. An id that is not a UUID names none of its files. */
const openUpload = async (
  submission: PostSubmissionActionSubmission,
  fileId: string,
): Promise<PostSubmissionActionUpload | 'missing'> =>
  isUuid(fileId)
    ? toUpload(await filesService.getForSubmission(submission.workspaceId, submission.id, fileId))
    : 'missing';

/**
 * The services for one action job, bound to its submission. Renders, like sends, are attributed to
 * the system user.
 */
export const actionServices = (
  job: JobFacts,
  submission: PostSubmissionActionSubmission,
  signal: AbortSignal,
  log: Logger,
): PostSubmissionActionServices => ({
  notifications: actionNotifications(job, signal, log),
  // Looked up on use, so an action that stages nothing runs without temp storage.
  tempStorage: {
    reserve: (opts) => getTempStorageAdapter().reserve(opts),
    remove: (resource) => getTempStorageAdapter().remove(resource),
  },
  answers: { readRevision: (revisionId) => readRevision(submission, revisionId, log) },
  documents: {
    render: async ({ revisionId, answers }) => {
      const revisionNo = isUuid(revisionId)
        ? await findSubmittedRevisionNo(submission.workspaceId, submission.id, revisionId)
        : null;
      // Not one of the submission's submitted revisions: there is no submitted revision to print.
      if (revisionNo === null) return { status: 'refused' };
      const actorId = await systemUserId();
      return toRenderOutcome(
        await jobDocumentService.renderRevision({
          workspaceId: submission.workspaceId,
          formId: submission.formId,
          formVersionId: submission.formVersionId,
          submissionId: submission.id,
          confirmationCode: submission.confirmationCode,
          revisionId,
          revisionNo,
          answers,
          actorId,
        }),
      );
    },
  },
  files: { open: (fileId) => openUpload(submission, fileId) },
});

/** Where an action stores its file. The result is attributed to the system user. */
export const actionResult = (
  context: Pick<JobContext, 'resultMaxBytes' | 'storeResult'>,
): PostSubmissionActionResult => ({
  maxBytes: context.resultMaxBytes,
  store: async (staged, meta) =>
    context.storeResult(staged, meta, { actorId: await systemUserId() }),
});
