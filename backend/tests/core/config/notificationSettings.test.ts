import { resolveNotificationSettings } from '../../../src/core/config/env';

describe('resolveNotificationSettings', () => {
  it('allows 3000 emails a day, from midnight in Vancouver, when nothing is set', () => {
    expect(resolveNotificationSettings({})).toEqual({
      dailyLimit: 3000,
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

  it.each(['0', '100001', '3000.5', 'many'])(
    'stops startup on a daily limit of %s, naming the variable',
    (value) => {
      expect(() => resolveNotificationSettings({ NOTIFICATION_DAILY_LIMIT: value })).toThrow(
        `NOTIFICATION_DAILY_LIMIT must be a whole number from 1 to 100000, got '${value}'`,
      );
    },
  );

  // Offsets and abbreviations pass Intl, but Postgres, which applies the zone, reads them differently.
  it.each(['Pacific/Nowhere', '-07:00', '+07:00', 'PST', 'america/vancouver'])(
    'stops startup on %s, which is not an IANA time zone as written, naming the variable',
    (zone) => {
      expect(() =>
        resolveNotificationSettings({ NOTIFICATION_DAILY_RESET_TIME_ZONE: zone }),
      ).toThrow(`NOTIFICATION_DAILY_RESET_TIME_ZONE is not an IANA time zone, got '${zone}'`);
    },
  );

  it.each(['UTC', 'Etc/GMT+7', 'America/Edmonton'])('takes %s as the zone', (zone) => {
    expect(
      resolveNotificationSettings({ NOTIFICATION_DAILY_RESET_TIME_ZONE: zone }).dailyResetTimeZone,
    ).toBe(zone);
  });
});
