import { resolveNotificationSettings } from '../../../src/core/config/env';

describe('resolveNotificationSettings', () => {
  it('resets the daily email limit at midnight in Vancouver when nothing is set', () => {
    expect(resolveNotificationSettings({})).toEqual({ dailyResetTimeZone: 'America/Vancouver' });
  });

  it('takes the reset time zone from its variable', () => {
    expect(
      resolveNotificationSettings({ NOTIFICATION_DAILY_RESET_TIME_ZONE: 'America/Edmonton' }),
    ).toEqual({ dailyResetTimeZone: 'America/Edmonton' });
  });

  it('stops startup on a zone that is not an IANA time zone, naming the variable', () => {
    expect(() =>
      resolveNotificationSettings({ NOTIFICATION_DAILY_RESET_TIME_ZONE: 'Pacific/Nowhere' }),
    ).toThrow("NOTIFICATION_DAILY_RESET_TIME_ZONE is not an IANA time zone, got 'Pacific/Nowhere'");
  });
});
