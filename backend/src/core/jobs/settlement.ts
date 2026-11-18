import { DrizzleQueryError } from 'drizzle-orm/errors';
import { pgErrorFields } from '../db/pgError';
import type { JobDeferral, JobFinish } from '../db/repos/jobRepo';
import { backoffDelayMs, deferDelayMs } from './timing';

/** Why the runner aborted a handler. */
export type JobStopReason = 'cancel' | 'timeout' | 'lease_lost' | 'drain';

/**
 * What the runner records for a claimed job: a finish, a release back to the queue, or a deferral
 * back to the queue after a delay.
 */
export type JobOutcome = JobFinish | { kind: 'release' } | ({ kind: 'defer' } & JobDeferral);

/** Thrown by a handler that decides its job should not run; the job ends cancelled, not retried. */
export class JobCancelledError extends Error {}

/** Thrown by a handler whose job would fail the same way on every attempt; the job ends dead. */
export class JobFailedError extends Error {}

/**
 * Thrown by a handler whose job has to wait, for a limit or a busy service. The job runs again after
 * its delay, from a second to a day, without using an attempt, and its message is recorded as the
 * job's last error.
 */
export class JobDeferredError extends Error {
  /** The delay, bounded by `deferDelayMs`. */
  readonly delayMs: number;

  constructor(delayMs: number, reason: string) {
    super(reason);
    this.delayMs = deferDelayMs(delayMs);
  }
}

/** How a handler that threw asked to end. */
export interface HandlerEnding {
  /** It threw `JobFailedError`. */
  permanent?: boolean;
  /** It threw `JobDeferredError` with this delay. */
  deferMs?: number;
}

/** How a handler's error asks its job to end; nothing for an ordinary failure. */
export const handlerEnding = (err: unknown): HandlerEnding => {
  if (err instanceof JobFailedError) return { permanent: true };
  if (err instanceof JobDeferredError) return { deferMs: err.delayMs };
  return {};
};

const MAX_ERROR_LENGTH = 2000;

/**
 * The text recorded and logged for a failed job. A database error's message carries the query and
 * its values, which can hold submitted data or addresses, so it is named by its code instead.
 */
export const errorText = (err: unknown): string => {
  const pg = pgErrorFields(err);
  if (pg) {
    const on = pg.constraint ? ` on ${pg.constraint}` : '';
    return `Database error ${pg.code}${on}`;
  }
  if (err instanceof DrizzleQueryError) {
    return err.cause ? `Database query failed: ${err.cause.name}` : 'Database query failed';
  }
  return (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_LENGTH);
};

/**
 * What to record when a handler returns; `error` is undefined when it succeeded. A success is
 * recorded even after an abort. A failure after a cancel ends cancelled; after a drain the job is
 * released without using an attempt; after a lost lease nothing is written. A deferral
 * (`JobDeferredError`) that did not time out goes back to the queue after its delay without using an
 * attempt, even on the last one. A permanent failure (`JobFailedError`) ends dead; any other
 * failure, a timeout included, counts as a failed attempt.
 */
export const decideOutcome = (
  error: string | undefined,
  stopReason: JobStopReason | undefined,
  job: { attempts: number; maxAttempts: number },
  backoff: { backoffBaseMs: number; backoffMaxMs: number },
  ending: HandlerEnding = {},
): JobOutcome | null => {
  if (error === undefined) return { kind: 'succeeded' };
  if (stopReason === 'cancel') return { kind: 'cancelled', error };
  if (stopReason === 'drain') return { kind: 'release' };
  if (stopReason === 'lease_lost') return null;
  if (ending.deferMs !== undefined && stopReason === undefined) {
    return { kind: 'defer', delayMs: deferDelayMs(ending.deferMs), reason: error };
  }
  if (ending.permanent || job.attempts >= job.maxAttempts) return { kind: 'dead', error };
  return { kind: 'retry', delayMs: backoffDelayMs(job.attempts, backoff), error };
};
