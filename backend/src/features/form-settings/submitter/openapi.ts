import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  SetSubmitterSettingsBodySchema as LibSetSubmitterSettingsBodySchema,
  SubmitterSettingsSchema as LibSubmitterSettingsSchema,
  SUBMITTER_SETTINGS_KEY,
} from '@soba/lib';
import type { RegisterOpenApiPaths } from '../../../core/api/shared/openapi';
import { registerSettingsPaths } from '../schema';

extendZodWithOpenApi(z);

export const SubmitterSettingsSchema =
  LibSubmitterSettingsSchema.clone().openapi('FormSettings_Submitter');
export const SetSubmitterSettingsBodySchema = LibSetSubmitterSettingsBodySchema.clone().openapi(
  'FormSettings_SetSubmitterBody',
);

export const registerSubmitterSettingsOpenApi: RegisterOpenApiPaths = (registry) =>
  registerSettingsPaths(registry, {
    key: SUBMITTER_SETTINGS_KEY,
    label: 'submitter settings',
    settingsSchema: SubmitterSettingsSchema,
    bodySchema: SetSubmitterSettingsBodySchema,
  });
