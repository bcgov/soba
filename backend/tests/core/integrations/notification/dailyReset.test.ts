import {
  DAILY_LIMIT_REACHED,
  deferUntilReset,
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
    expect(roomToday(3000, { counted, limited: false })).toBe(room);
  });

  it('leaves none once the provider refused a send at its limit today', () => {
    expect(roomToday(3000, { counted: 10, limited: true })).toBe(0);
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
