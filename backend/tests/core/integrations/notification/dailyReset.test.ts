import {
  DAILY_LIMIT_REACHED,
  deferUntilPauseEnds,
  deferUntilReset,
  limitPauseEnds,
  PROVIDER_LIMIT_REACHED,
  roomToday,
} from '../../../../src/core/integrations/notification/dailyReset';
import { JobDeferredError } from '../../../../src/core/jobs/errors';

describe('roomToday', () => {
  it.each([
    ['nothing sent yet', 0, 3000],
    ['some sent', 2999, 1],
    ['the limit sent', 3000, 0],
    ['more than the limit sent, by jobs sending at once', 3003, 0],
  ])('leaves the limit less the sends when %s', (_case, counted, room) => {
    expect(roomToday(3000, counted)).toBe(room);
  });
});

describe('limitPauseEnds', () => {
  const last = new Date('2026-11-19T20:00:00Z');
  const at = (ms: number) => new Date(last.getTime() + ms);

  it.each([
    [1, 60_000],
    [2, 120_000],
    [3, 240_000],
    [6, 1_920_000],
    [7, 3_600_000],
    [50, 3_600_000],
  ])(
    'pauses after %s minutes of refusals in a row for %s ms, up to an hour',
    (limitedInARow, pauseMs) => {
      expect(limitPauseEnds(last, limitedInARow, at(1000))).toEqual(at(pauseMs));
    },
  );

  it('is over once its time has passed', () => {
    expect(limitPauseEnds(last, 1, at(60_000))).toBeNull();
  });

  it('pauses nothing without a refusal since an email was accepted', () => {
    expect(limitPauseEnds(null, 0, at(1000))).toBeNull();
    expect(limitPauseEnds(last, 0, at(1000))).toBeNull();
  });
});

describe('deferUntilReset', () => {
  const now = new Date('2026-11-19T20:00:00Z');
  const reset = new Date('2026-11-20T08:00:00Z');

  it('waits for the reset, giving the reason', () => {
    const deferral = deferUntilReset(reset, now, () => 0);
    expect(deferral).toBeInstanceOf(JobDeferredError);
    expect(deferral.message).toBe(DAILY_LIMIT_REACHED);
    expect(deferral.delayMs).toBe(12 * 3_600_000);
  });

  it('spreads the waiting jobs over the five minutes after it', () => {
    const random = jest.fn(() => 299_999);
    expect(deferUntilReset(reset, now, random).delayMs).toBe(12 * 3_600_000 + 299_999);
    expect(random).toHaveBeenCalledWith(300_000);
  });

  // Midnight passed while the job was sending: it goes again at once and counts the new day.
  it('waits a second for a reset already past', () => {
    expect(deferUntilReset(reset, new Date('2026-11-20T08:00:30Z'), () => 0).delayMs).toBe(1000);
  });
});

describe('deferUntilPauseEnds', () => {
  const now = new Date('2026-11-19T20:00:00Z');

  it("waits for the pause to end, spread over the half minute after, with the provider's reason", () => {
    const random = jest.fn(() => 29_999);
    const deferral = deferUntilPauseEnds(new Date(now.getTime() + 120_000), now, random);
    expect(deferral).toBeInstanceOf(JobDeferredError);
    expect(deferral.message).toBe(PROVIDER_LIMIT_REACHED);
    expect(deferral.delayMs).toBe(120_000 + 29_999);
    expect(random).toHaveBeenCalledWith(30_000);
  });

  it('waits a first pause from now when none shows', () => {
    expect(deferUntilPauseEnds(null, now, () => 0).delayMs).toBe(60_000);
  });
});
