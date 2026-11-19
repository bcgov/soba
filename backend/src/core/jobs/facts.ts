import type { JobRecord } from '../db/repos/jobRepo';

/** A job's current run: queued when the job is created, and again at each re-run. */
export interface JobRun {
  /** 1, then one more for each re-run. */
  number: number;
  queuedAt: Date;
  /** Who queued the run: the job's creator, or the person who ran it again. */
  queuedBy: string;
}

/**
 * What a handler knows about its job: what the job is about and which run this is. How the job is
 * claimed and leased stays with the runner.
 */
export interface JobFacts {
  id: string;
  type: string;
  workspaceId: string;
  formId: string | null;
  submissionId: string | null;
  revisionId: string | null;
  /** Ids and options only, never answer data. */
  params: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  /** The attempt within this run, from 1. */
  attempt: number;
  run: JobRun;
}

/** The facts a handler gets for a claimed job's row. */
export const jobFacts = (row: JobRecord): JobFacts => ({
  id: row.id,
  type: row.type,
  workspaceId: row.workspaceId,
  formId: row.formId,
  submissionId: row.submissionId,
  revisionId: row.revisionId,
  params: row.params,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
  attempt: row.attempts,
  run: {
    number: row.requeueCount + 1,
    queuedAt: row.lastRequeuedAt ?? row.createdAt,
    queuedBy: row.lastRequeuedBy ?? row.createdBy,
  },
});
