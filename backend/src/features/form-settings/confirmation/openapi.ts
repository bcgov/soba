import { CONFIRMATION_SETTINGS_KEY, ConfirmationSettingsSchema } from '@soba/lib';
import type { RegisterOpenApiPaths } from '../../../core/api/shared/openapi';
import { inheritableOpenApiSchemas, registerInheritableSettingsPaths } from '../schema';

const schemas = inheritableOpenApiSchemas(ConfirmationSettingsSchema, 'Confirmation');

export const WorkspaceConfirmationSettingsSchema = schemas.workspace;
export const SetFormConfirmationSettingsBodySchema = schemas.formBody;

export const registerConfirmationSettingsOpenApi: RegisterOpenApiPaths = (registry) =>
  registerInheritableSettingsPaths(registry, {
    key: CONFIRMATION_SETTINGS_KEY,
    label: 'confirmation settings',
    schemas,
  });
