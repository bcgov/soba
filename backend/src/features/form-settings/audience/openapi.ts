import { AUDIENCE_SETTINGS_KEY, AudienceSchema } from '@soba/lib';
import type { RegisterOpenApiPaths } from '../../../core/api/shared/openapi';
import { inheritableOpenApiSchemas, registerInheritableSettingsPaths } from '../schema';

const schemas = inheritableOpenApiSchemas(AudienceSchema, 'Audience');

export const WorkspaceAudienceSettingsSchema = schemas.workspace;
export const SetFormAudienceSettingsBodySchema = schemas.formBody;

export const registerAudienceSettingsOpenApi: RegisterOpenApiPaths = (registry) =>
  registerInheritableSettingsPaths(registry, {
    key: AUDIENCE_SETTINGS_KEY,
    label: 'audience',
    schemas,
  });
