import type { Tx } from '../db/client';
import { JobType, SubmissionEventType, type SubmissionWriteEventCode } from '../db/codes';
import { insertJob } from '../db/repos/jobRepo';
import type { SubmissionRecord } from '../db/repos/submissionRepo';
import { submissionSubmittedJob } from './handlers/submissionSubmitted';
import { getJobSettings } from './settings';

/** A submit queues the submitted job when the post-submission flag is on. A save never reads it. */
export const queuesSubmittedJob = async (
  eventType: SubmissionWriteEventCode,
  isFlagOn: () => Promise<boolean>,
): Promise<boolean> => eventType === SubmissionEventType.submitted && (await isFlagOn());

/** Queue the submitted job in the transaction that lands the submit. One job per revision. */
export const enqueueSubmittedJob = async (
  tx: Tx,
  submission: SubmissionRecord,
  revisionId: string,
  actorId: string,
): Promise<void> => {
  await insertJob(tx, {
    type: JobType.submission_submitted,
    workspaceId: submission.workspaceId,
    formId: submission.formId,
    submissionId: submission.id,
    revisionId,
    createdBy: actorId,
    dedupeKey: `${JobType.submission_submitted}:${revisionId}`,
    maxAttempts: submissionSubmittedJob.maxAttempts ?? getJobSettings().maxAttempts,
  });
};
