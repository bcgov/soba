import { randomInt } from 'node:crypto';
import { JobDeferredError } from '../../jobs/errors';

/** Why an email job waits: the environment's sends today reached NOTIFICATION_DAILY_LIMIT. */
export const DAILY_LIMIT_REACHED =
  'Daily email limit reached; the rest are sent after it resets at midnight';

/** Why an email job waits: the provider refused a send at its limit. */
export const PROVIDER_LIMIT_REACHED =
  "Email provider's limit reached; email waits from a minute to an hour, then tries again";

// The jobs waiting for the reset start over its first five minutes, not all at once.
const RESET_SPREAD_MS = 300_000;
// The jobs waiting out a pause start over the half minute after it.
const PAUSE_SPREAD_MS = 30_000;
const FIRST_PAUSE_MS = 60_000;
const LONGEST_PAUSE_MS = 3_600_000;

/**
 * Emails the environment may still send today: NOTIFICATION_DAILY_LIMIT less the sends the
 * provider accepted or refused for the address since the last midnight in
 * NOTIFICATION_DAILY_RESET_TIME_ZONE, never below zero.
 */
export const roomToday = (dailyLimit: number, counted: number): number =>
  Math.max(dailyLimit - counted, 0);

/**
 * When every email job may send again after the provider refused sends at its limit: a minute after
 * the last refusal when it is the first since an email was accepted, doubling with each one after,
 * up to an hour. Null when no pause is in force at `now`.
 */
export const limitPauseEnds = (
  lastLimitedAt: Date | null,
  limitedInARow: number,
  now: Date,
): Date | null => {
  if (lastLimitedAt === null || limitedInARow < 1) return null;
  const pauseMs = Math.min(FIRST_PAUSE_MS * 2 ** (limitedInARow - 1), LONGEST_PAUSE_MS);
  const ends = new Date(lastLimitedAt.getTime() + pauseMs);
  return ends > now ? ends : null;
};

/**
 * The deferral to the daily reset, `resetInMs` away, spread over the five minutes after it. A reset
 * already past waits a second; a wait past a day is cut to a day, and the job defers again when it
 * wakes.
 */
export const deferUntilReset = (
  resetInMs: number,
  random: (max: number) => number = randomInt,
): JobDeferredError =>
  new JobDeferredError(resetInMs + random(RESET_SPREAD_MS), DAILY_LIMIT_REACHED);

/**
 * The deferral to the end of a pause after the provider's limit, `pauseLeftMs` away, spread over
 * the half minute after; a first pause when none shows, as when a send that started after the
 * refusal was accepted.
 */
export const deferUntilPauseEnds = (
  pauseLeftMs: number | null,
  random: (max: number) => number = randomInt,
): JobDeferredError =>
  new JobDeferredError(
    (pauseLeftMs ?? FIRST_PAUSE_MS) + random(PAUSE_SPREAD_MS),
    PROVIDER_LIMIT_REACHED,
  );
