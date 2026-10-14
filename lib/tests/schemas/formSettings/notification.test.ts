import {
  FormNotificationSettingsSchema,
  NotificationSettingsSchema,
} from '../../../src/schemas/formSettings';

describe('notification settings', () => {
  it('allows an empty list to disable notifications', () => {
    expect(
      FormNotificationSettingsSchema.parse({ values: { recipients: [] }, version: 1 }).values
        .recipients,
    ).toEqual([]);
  });
  it('trims and deduplicates addresses', () => {
    expect(
      NotificationSettingsSchema.parse({ recipients: [' Staff@Example.com ', 'staff@example.com'] })
        .recipients,
    ).toEqual(['staff@example.com']);
  });
  it.each([
    { recipients: ['invalid'] },
    { recipients: 'staff@example.com' },
    {},
    { recipients: Array.from({ length: 101 }, (_, i) => `staff${i}@example.com`) },
  ])('rejects invalid recipients: %j', (values) => {
    expect(NotificationSettingsSchema.safeParse(values).success).toBe(false);
  });
  it('requires a version', () => {
    expect(FormNotificationSettingsSchema.safeParse({ values: { recipients: [] } }).success).toBe(
      false,
    );
  });
});
