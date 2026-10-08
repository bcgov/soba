import { FormNotificationSettingsSchema as LibSchema, NOTIFICATION_SETTINGS_KEY } from '@soba/lib';
import type { RegisterOpenApiPaths } from '../../../core/api/shared/openapi';
import { registerSettingsPaths } from '../schema';
export const FormNotificationSettingsSchema = LibSchema.clone().openapi(
  'FormSettings_FormNotification',
);
export const registerNotificationSettingsOpenApi: RegisterOpenApiPaths = (registry) =>
  registerSettingsPaths(registry, {
    key: NOTIFICATION_SETTINGS_KEY,
    label: 'email notification settings',
    settingsSchema: FormNotificationSettingsSchema,
    bodySchema: FormNotificationSettingsSchema,
  });
