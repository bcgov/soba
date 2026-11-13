import { CONFIRMATION_SETTINGS_KEY } from '@soba/lib';
import { formConfirmationSettings, workspaceConfirmationSettings } from '../../../core/db/schema';
import { settingsRoutes } from '../routes';
import type { FormSettingsModule } from '../types';
import {
  registerConfirmationSettingsOpenApi,
  SetFormConfirmationSettingsBodySchema,
  WorkspaceConfirmationSettingsSchema,
} from './openapi';
import { formConfirmationSettingsService, workspaceConfirmationSettingsService } from './service';
import { createConfirmationSettings, createWorkspaceConfirmationSettings } from './repo';

export { formConfirmationSettingsService, workspaceConfirmationSettingsService } from './service';

export const confirmationSettingsModule: FormSettingsModule = {
  key: CONFIRMATION_SETTINGS_KEY,
  weight: 35,
  router: () =>
    settingsRoutes(formConfirmationSettingsService, SetFormConfirmationSettingsBodySchema),
  registerOpenApi: registerConfirmationSettingsOpenApi,
  tables: [formConfirmationSettings, workspaceConfirmationSettings],
  createForForm: createConfirmationSettings,
  workspace: {
    router: () =>
      settingsRoutes(
        workspaceConfirmationSettingsService,
        WorkspaceConfirmationSettingsSchema,
        'workspace',
      ),
    createForWorkspace: createWorkspaceConfirmationSettings,
  },
};
