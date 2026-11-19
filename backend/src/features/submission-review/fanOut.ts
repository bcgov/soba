import { db } from '../../core/db/client';
import type { ChildJob } from '../../core/db/repos/jobRepo';
import type { JobFacts } from '../../core/jobs/facts';
import type { JobContext } from '../../core/jobs/registry';
import { JobCancelledError } from '../../core/jobs/settlement';
import { isSubmissionLive, SUBMISSION_GONE } from '../post-submission/repo';
import { StatusChangedJobParamsSchema } from './params';
import { reactionAttempts, type StatusReaction } from './statusReactions';

/**
 * One reaction's job: a child of the status-changed job, at most one per reaction and change, with
 * the options recorded for it.
 */
export const reactionJob = (
  parent: JobFacts,
  statusChangeId: string,
  reaction: StatusReaction,
  maxAttempts: number,
): ChildJob => ({
  type: reaction.code,
  formId: parent.formId,
  submissionId: parent.submissionId,
  createdBy: parent.createdBy,
  params: { statusChangeId, options: reaction.options },
  dedupeKey: `${reaction.code}:${statusChangeId}`,
  maxAttempts,
});

/**
 * The status-changed job's run: queue one job per reaction recorded with the change, in one
 * transaction. Dedupe keys make a retry safe. Each reaction's job decides whether it still runs.
 * Ends cancelled, queuing nothing, once the submission, its form or its workspace is gone.
 */
export const fanOutStatusChanged = async ({
  job,
  log,
  queueChildren,
}: JobContext): Promise<void> => {
  const { statusChangeId, actions } = StatusChangedJobParamsSchema.parse(job.params);
  log.info({ submissionId: job.submissionId, statusChangeId }, 'Status changed');
  if (actions.length === 0) return;

  const live =
    job.submissionId !== null &&
    (await isSubmissionLive(db, { workspaceId: job.workspaceId, submissionId: job.submissionId }));
  if (!live) throw new JobCancelledError(SUBMISSION_GONE);

  const jobIds = await queueChildren(
    actions.map((action) =>
      reactionJob(job, statusChangeId, action, reactionAttempts(action.code)),
    ),
  );
  log.info(
    {
      // A null job id means the reaction was already queued for this change.
      queued: actions.map((action, index) => ({ code: action.code, jobId: jobIds[index] })),
    },
    'Status change reactions queued',
  );
};
