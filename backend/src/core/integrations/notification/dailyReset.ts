import { randomInt } from 'node:crypto';
import { JobDeferredError } from '../../jobs/errors';

/** Why an email job waits: the environment's sends today reached NOTIFICATION_DAILY_LIMIT. */
export const DAILY_LIMIT_REACHED =
  'Daily email limit reached; the rest are sent after it resets at midnight';

/** Why an email job waits: the provider refused a send at its limit. */
export const PROVIDER_LIMIT_REACHED =
  "Email provider's limit reached; the rest are tried again after midnight";

// The jobs waiting for the reset start over its first five minutes, not all at once.
const RESET_SPREAD_MS = 300_000;

/**
 * Emails the environment may still send today: NOTIFICATION_DAILY_LIMIT less the sends the provider
 * accepted or refused for the address since the last midnight in NOTIFICATION_DAILY_RESET_TIME_ZONE,
 * never below zero, and none once the provider refused a send at its limit today.
 */
export const roomToday = (
  dailyLimit: number,
  day: { counted: number; limited: boolean },
): number => (day.limited ? 0 : Math.max(dailyLimit - day.counted, 0));

/**
 * The deferral to `resetsAt`, a daily reset, spread over the five minutes after it, with `reason`
 * shown on the job. A reset already past waits a second; a wait past a day is cut to a day, and the
 * job defers again when it wakes.
 */
export const deferUntilReset = (
  resetsAt: Date,
  reason: string,
  now: Date = new Date(),
  random: (max: number) => number = randomInt,
): JobDeferredError =>
  new JobDeferredError(resetsAt.getTime() - now.getTime() + random(RESET_SPREAD_MS), reason);
