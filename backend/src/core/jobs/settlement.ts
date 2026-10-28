import type { JobFinish } from '../db/repos/jobRepo';
import { backoffDelayMs } from './timing';

/** Why the runner aborted a handler. */
export type JobStopReason = 'cancel' | 'timeout' | 'lease_lost' | 'drain';

/** What the runner records for a claimed job: a finish, or a release back to the queue. */
export type JobOutcome = JobFinish | { kind: 'release' };

/** Thrown by a handler that decides its job should not run; the job ends cancelled, not retried. */
export class JobCancelledError extends Error {}

const MAX_ERROR_LENGTH = 2000;

export const errorText = (err: unknown): string =>
  (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_LENGTH);

/**
 * What to record when a handler returns; `error` is undefined when it succeeded. A success is
 * recorded even after an abort. A failure after a cancel ends cancelled; after a drain the job is
 * released without using an attempt; after a lost lease nothing is written. A timeout counts as a
 * failed attempt.
 */
export const decideOutcome = (
  error: string | undefined,
  stopReason: JobStopReason | undefined,
  job: { attempts: number; maxAttempts: number },
  backoff: { backoffBaseMs: number; backoffMaxMs: number },
): JobOutcome | null => {
  if (error === undefined) return { kind: 'succeeded' };
  if (stopReason === 'cancel') return { kind: 'cancelled', error };
  if (stopReason === 'drain') return { kind: 'release' };
  if (stopReason === 'lease_lost') return null;
  if (job.attempts >= job.maxAttempts) return { kind: 'dead', error };
  return { kind: 'retry', delayMs: backoffDelayMs(job.attempts, backoff), error };
};
