import { deferDelayMs } from './timing';

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
