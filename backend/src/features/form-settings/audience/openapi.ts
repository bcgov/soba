import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  AUDIENCE_SETTINGS_KEY,
  FormAudienceSettingsSchema as LibFormAudienceSettingsSchema,
  SetFormAudienceSettingsBodySchema as LibSetFormAudienceSettingsBodySchema,
  WorkspaceAudienceSettingsSchema as LibWorkspaceAudienceSettingsSchema,
} from '@soba/lib';
import type { RegisterOpenApiPaths } from '../../../core/api/shared/openapi';
import { registerSettingsPaths } from '../schema';

extendZodWithOpenApi(z);

export const WorkspaceAudienceSettingsSchema =
  LibWorkspaceAudienceSettingsSchema.clone().openapi('FormSettings_Audience');
export const FormAudienceSettingsSchema = LibFormAudienceSettingsSchema.clone().openapi(
  'FormSettings_FormAudience',
);
export const SetFormAudienceSettingsBodySchema =
  LibSetFormAudienceSettingsBodySchema.clone().openapi('FormSettings_SetFormAudienceBody');

export const registerAudienceSettingsOpenApi: RegisterOpenApiPaths = (registry) => {
  registerSettingsPaths(registry, {
    key: AUDIENCE_SETTINGS_KEY,
    label: 'audience',
    settingsSchema: FormAudienceSettingsSchema,
    bodySchema: SetFormAudienceSettingsBodySchema,
  });
  registerSettingsPaths(registry, {
    key: AUDIENCE_SETTINGS_KEY,
    label: 'audience',
    settingsSchema: WorkspaceAudienceSettingsSchema,
    bodySchema: WorkspaceAudienceSettingsSchema,
    scope: 'workspace',
  });
};
