import { JobPool } from '../../config/env';
import { JobType } from '../../db/codes';
import type { JobTypeDefinition } from '../registry';

/** Queued when a submit lands as the new head. Only records that the submission arrived. */
export const submissionSubmittedJob: JobTypeDefinition = {
  type: JobType.submission_submitted,
  pool: JobPool.light,
  run: ({ job, log }) => {
    log.info({ submissionId: job.submissionId, revisionId: job.revisionId }, 'Submission received');
    return Promise.resolve();
  },
};
