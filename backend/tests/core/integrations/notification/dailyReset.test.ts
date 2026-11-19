import {
  DAILY_LIMIT_REACHED,
  deferUntilReset,
  lastMidnight,
  nextMidnight,
  PROVIDER_LIMIT_REACHED,
} from '../../../../src/core/integrations/notification/dailyReset';
import { JobDeferredError } from '../../../../src/core/jobs/errors';

// A zone that never changes its clocks: seven hours behind UTC.
const UTC_MINUS_7 = 'Etc/GMT+7';

/** The date in `timeZone` at `instant`, as yyyy-mm-dd. */
const dateIn = (instant: number, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);

describe('nextMidnight', () => {
  it.each([
    ['in the morning', '2026-11-19T13:00:00Z', '2026-11-20T07:00:00Z'],
    ['a second before midnight', '2026-11-20T06:59:59Z', '2026-11-20T07:00:00Z'],
    ['at midnight itself', '2026-11-20T07:00:00Z', '2026-11-21T07:00:00Z'],
    ['across a month and a year', '2026-12-31T20:00:00Z', '2027-01-01T07:00:00Z'],
  ])('gives the next local midnight %s', (_case, now, expected) => {
    expect(nextMidnight(new Date(now), UTC_MINUS_7)).toEqual(new Date(expected));
  });

  // Whatever rules a zone follows, the result is the first instant of the next local day. The
  // instants sit on or next to clock changes: Vancouver's at 02:00, and zones whose changes skip
  // or repeat midnight.
  it.each([
    ['America/Vancouver', '2026-01-15T12:00:00Z'],
    ['America/Vancouver', '2026-03-08T09:30:00Z'],
    ['America/Vancouver', '2026-03-08T11:00:00Z'],
    ['America/Vancouver', '2026-11-01T08:30:00Z'],
    ['America/Vancouver', '2026-11-01T10:00:00Z'],
    ['America/Vancouver', '2026-11-19T13:00:00Z'],
    ['America/Havana', '2027-03-13T15:00:00Z'],
    ['America/Havana', '2026-11-01T02:00:00Z'],
    ['America/Santiago', '2026-09-05T15:00:00Z'],
    ['America/Santiago', '2026-04-04T15:00:00Z'],
    ['Atlantic/Azores', '2026-03-28T12:00:00Z'],
  ])('starts the next day in %s from %s', (zone, now) => {
    const from = new Date(now).getTime();
    const start = nextMidnight(new Date(now), zone).getTime();
    expect(start).toBeGreaterThan(from);
    expect(dateIn(start - 1000, zone)).toBe(dateIn(from, zone));
    expect(dateIn(start, zone)).not.toBe(dateIn(from, zone));
  });
});

describe('lastMidnight', () => {
  it.each([
    ['in the morning', '2026-11-19T13:00:00Z', '2026-11-19T07:00:00Z'],
    ['a second before midnight', '2026-11-20T06:59:59Z', '2026-11-19T07:00:00Z'],
    ['at midnight itself', '2026-11-20T07:00:00Z', '2026-11-20T07:00:00Z'],
  ])('gives the local midnight that started the day %s', (_case, now, expected) => {
    expect(lastMidnight(new Date(now), UTC_MINUS_7)).toEqual(new Date(expected));
  });

  // Rule-independent, as above: the first instant of the day the instant falls in.
  it.each([
    ['America/Vancouver', '2026-03-08T11:00:00Z'],
    ['America/Vancouver', '2026-11-01T10:00:00Z'],
    ['America/Havana', '2027-03-14T15:00:00Z'],
    ['America/Santiago', '2026-09-06T15:00:00Z'],
  ])('starts the day in %s at %s', (zone, now) => {
    const at = new Date(now).getTime();
    const start = lastMidnight(new Date(now), zone).getTime();
    expect(start).toBeLessThanOrEqual(at);
    expect(dateIn(start, zone)).toBe(dateIn(at, zone));
    expect(dateIn(start - 1000, zone)).not.toBe(dateIn(at, zone));
  });
});

describe('deferUntilReset', () => {
  const now = new Date('2026-11-19T20:00:00Z');
  const reset = new Date('2026-11-20T08:00:00Z');

  it('waits for the reset, giving the reason', () => {
    const deferral = deferUntilReset(reset, PROVIDER_LIMIT_REACHED, now, () => 0);
    expect(deferral).toBeInstanceOf(JobDeferredError);
    expect(deferral.message).toBe(PROVIDER_LIMIT_REACHED);
    expect(deferral.delayMs).toBe(12 * 3_600_000);
  });

  it('spreads the waiting jobs over the five minutes after it', () => {
    const random = jest.fn(() => 299_999);
    expect(deferUntilReset(reset, DAILY_LIMIT_REACHED, now, random).delayMs).toBe(
      12 * 3_600_000 + 299_999,
    );
    expect(random).toHaveBeenCalledWith(300_000);
  });

  // Midnight passed while the job was sending: it goes again at once and counts the new day.
  it('waits a second for a reset already past', () => {
    expect(
      deferUntilReset(reset, DAILY_LIMIT_REACHED, new Date('2026-11-20T08:00:30Z'), () => 0)
        .delayMs,
    ).toBe(1000);
  });
});
