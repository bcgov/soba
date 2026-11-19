import { resolveNotificationSettings } from '../../../src/core/config/env';

describe('resolveNotificationSettings', () => {
  it('allows 3225 emails a day, from midnight in Vancouver, when nothing is set', () => {
    expect(resolveNotificationSettings({})).toEqual({
      dailyLimit: 3225,
      dailyResetTimeZone: 'America/Vancouver',
    });
  });

  it('takes each setting from its variable', () => {
    expect(
      resolveNotificationSettings({
        NOTIFICATION_DAILY_LIMIT: '100000',
        NOTIFICATION_DAILY_RESET_TIME_ZONE: 'America/Edmonton',
      }),
    ).toEqual({ dailyLimit: 100_000, dailyResetTimeZone: 'America/Edmonton' });
  });

  it.each(['0', '100001', '3225.5', 'many'])(
    'stops startup on a daily limit of %s, naming the variable',
    (value) => {
      expect(() => resolveNotificationSettings({ NOTIFICATION_DAILY_LIMIT: value })).toThrow(
        `NOTIFICATION_DAILY_LIMIT must be a whole number from 1 to 100000, got '${value}'`,
      );
    },
  );

  it('stops startup on a zone that is not an IANA time zone, naming the variable', () => {
    expect(() =>
      resolveNotificationSettings({ NOTIFICATION_DAILY_RESET_TIME_ZONE: 'Pacific/Nowhere' }),
    ).toThrow("NOTIFICATION_DAILY_RESET_TIME_ZONE is not an IANA time zone, got 'Pacific/Nowhere'");
  });
});
