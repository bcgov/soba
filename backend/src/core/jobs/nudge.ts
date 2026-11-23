import type { JobRunner } from './runner';

let started: JobRunner | undefined;

/** Record the runner this process started, for `nudgeJobs`. */
export const setNudgedRunner = (runner: JobRunner): void => {
  started = runner;
};

/**
 * Claim queued jobs of `type` now, when this process runs its pool. This module imports no job
 * handler, so code that queues jobs can use it.
 */
export const nudgeJobs = (type: string): void => {
  started?.nudgeType(type);
};
