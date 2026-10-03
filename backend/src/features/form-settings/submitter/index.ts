import { SUBMITTER_SETTINGS_KEY } from '@soba/lib';
import { formSubmitterSettings } from '../../../core/db/schema';
import { settingsRoutes } from '../routes';
import type { FormSettingsModule } from '../types';
import { registerSubmitterSettingsOpenApi, SetSubmitterSettingsBodySchema } from './openapi';
import { submitterSettingsService } from './service';
import { createSubmitterSettings } from './repo';

export { submitterSettingsService } from './service';
export { DraftSaveStatus, getDraftSaveStatus, type DraftSaveStatusCode } from './drafts';

export const submitterSettingsModule: FormSettingsModule = {
  key: SUBMITTER_SETTINGS_KEY,
  weight: 10,
  router: () => settingsRoutes(submitterSettingsService, SetSubmitterSettingsBodySchema),
  registerOpenApi: registerSubmitterSettingsOpenApi,
  tables: [formSubmitterSettings],
  createForForm: createSubmitterSettings,
};
