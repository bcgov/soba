import { NOTIFICATION_SETTINGS_KEY } from '@soba/lib';
import { formNotificationSettings } from '../../../core/db/schema';
import { settingsRoutes } from '../routes';
import type { FormSettingsModule } from '../types';
import { FormNotificationSettingsSchema, registerNotificationSettingsOpenApi } from './openapi';
import { formNotificationSettingsService } from './service';
import { createNotificationSettings } from './repo';
export const notificationSettingsModule: FormSettingsModule = {
  key: NOTIFICATION_SETTINGS_KEY,
  weight: 20,
  router: () => settingsRoutes(formNotificationSettingsService, FormNotificationSettingsSchema),
  registerOpenApi: registerNotificationSettingsOpenApi,
  tables: [formNotificationSettings],
  createForForm: createNotificationSettings,
};
