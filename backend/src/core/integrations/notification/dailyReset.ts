import { randomInt } from 'node:crypto';
import { JobDeferredError } from '../../jobs/settlement';
import { getNotificationSettings } from './settings';

/** Why an email job waits: its sends are past the daily limit. */
export const DAILY_LIMIT_REACHED =
  'Daily email limit reached; the rest are sent after it resets at midnight';

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

/** The start of the next day in `timeZone` after `now`: its midnight, or the first instant after. */
export const nextMidnight = (now: Date, timeZone: string): Date => {
  const today = new Date(wallClockMs(now.getTime(), timeZone));
  const tomorrow = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1);
  const midnight = instantAt(tomorrow, timeZone);
  // Where a clock change skips midnight, the guess lands the evening before; the day starts after.
  return new Date(midnight + Math.max(tomorrow - wallClockMs(midnight, timeZone), 0));
};

/**
 * The deferral to the next midnight in NOTIFICATION_DAILY_RESET_TIME_ZONE, spread over the five
 * minutes after it. A wait past a day is cut to a day, and the job defers again when it wakes.
 */
export const deferUntilDailyReset = (
  now: Date = new Date(),
  random: (max: number) => number = randomInt,
): JobDeferredError => {
  const reset = nextMidnight(now, getNotificationSettings().dailyResetTimeZone);
  return new JobDeferredError(
    reset.getTime() - now.getTime() + random(RESET_SPREAD_MS),
    DAILY_LIMIT_REACHED,
  );
};
