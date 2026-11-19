import { randomInt } from 'node:crypto';
import { JobDeferredError } from '../../jobs/settlement';

/** Why an email job waits: the environment's sends today reached NOTIFICATION_DAILY_LIMIT. */
export const DAILY_LIMIT_REACHED =
  'Daily email limit reached; the rest are sent after it resets at midnight';

/** Why an email job waits: the provider refused a send at its own limit. */
export const PROVIDER_LIMIT_REACHED =
  "Email provider's limit reached; the rest are tried again after midnight";

// The jobs waiting for the reset start over its first five minutes, not all at once.
const RESET_SPREAD_MS = 300_000;

/** The wall clock in `timeZone` at `instantMs`, to the second, read as if it were UTC. */
const wallClockMs = (instantMs: number, timeZone: string): number => {
  const part = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(instantMs)
      .map(({ type, value }) => [type, Number(value)]),
  );
  return Date.UTC(part.year, part.month - 1, part.day, part.hour, part.minute, part.second);
};

/** The instant whose wall clock in `timeZone` reads `wallMs`, a whole second. */
const instantAt = (wallMs: number, timeZone: string): number => {
  const guess = wallMs - (wallClockMs(wallMs, timeZone) - wallMs);
  // The offset at the guess, which differs from the first one across a clock change.
  return wallMs - (wallClockMs(guess, timeZone) - guess);
};

/**
 * The first instant of the local day `daysAhead` days from the one `now` falls in: its midnight, or
 * the first instant after where a clock change skips midnight.
 */
const dayStart = (now: Date, timeZone: string, daysAhead: number): Date => {
  const today = new Date(wallClockMs(now.getTime(), timeZone));
  const wallMs = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() + daysAhead,
  );
  const midnight = instantAt(wallMs, timeZone);
  // Where a clock change skips midnight, the guess lands the evening before; the day starts after.
  return new Date(midnight + Math.max(wallMs - wallClockMs(midnight, timeZone), 0));
};

/** The start of the day in `timeZone` that `now` falls in. */
export const lastMidnight = (now: Date, timeZone: string): Date => dayStart(now, timeZone, 0);

/** The start of the next day in `timeZone` after `now`. */
export const nextMidnight = (now: Date, timeZone: string): Date => dayStart(now, timeZone, 1);

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
