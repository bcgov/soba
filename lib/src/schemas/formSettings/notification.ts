import { z } from 'zod';
import { SettingsVersionSchema } from './inheritable';

export const NOTIFICATION_SETTINGS_KEY = 'notification';
export const NotificationSettingsSchema = z.strictObject({
  recipients: z
    .array(z.string().trim().pipe(z.email()))
    .max(100)
    .transform((addresses) => [...new Set(addresses.map((address) => address.toLowerCase()))]),
});
export const FormNotificationSettingsSchema = z.strictObject({
  values: NotificationSettingsSchema,
  version: SettingsVersionSchema,
});
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;
export type FormNotificationSettings = z.infer<typeof FormNotificationSettingsSchema>;
