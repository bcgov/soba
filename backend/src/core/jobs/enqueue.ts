import type { Tx } from '../db/client';
import { JobType, SubmissionEventType, type SubmissionWriteEventCode } from '../db/codes';
import { insertJob } from '../db/repos/jobRepo';
import type { SubmissionRecord } from '../db/repos/submissionRepo';
import type { PostSubmissionActionPluginDefinition } from '../integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { resolveSubmittedActions } from '../../features/post-submission/resolve';
import { getJobSettings } from './settings';
import { submissionSubmittedJob } from './submissionSubmitted';

/** A submit queues the submitted job when the post-submission flag is on. A save never reads it. */
export const queuesSubmittedJob = async (
  eventType: SubmissionWriteEventCode,
  isFlagOn: () => Promise<boolean>,
): Promise<boolean> => eventType === SubmissionEventType.submitted && (await isFlagOn());

/**
 * Queue the submitted job in the transaction that lands the submit. One job per revision. Its params
 * record which of `plugins` the form's settings turn on now, so later settings changes do not alter
 * them.
 */
export const enqueueSubmittedJob = async (
  tx: Tx,
  submission: SubmissionRecord,
  revisionId: string,
  actorId: string,
  plugins: readonly PostSubmissionActionPluginDefinition[],
): Promise<void> => {
  const actions = await resolveSubmittedActions(
    tx,
    submission.workspaceId,
    submission.formId,
    plugins,
  );
  await insertJob(tx, {
    type: JobType.submission_submitted,
    workspaceId: submission.workspaceId,
    formId: submission.formId,
    submissionId: submission.id,
    revisionId,
    createdBy: actorId,
    params: { actions },
    dedupeKey: `${JobType.submission_submitted}:${revisionId}`,
    maxAttempts: submissionSubmittedJob.maxAttempts ?? getJobSettings().maxAttempts,
  });
};
