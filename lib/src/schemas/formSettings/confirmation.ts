import { z } from 'zod';
import {
  inheritableSettingsSchemas,
  type InheritableSettings,
  type SetInheritableSettingsBody,
  type WorkspaceSettings,
} from './inheritable';

/** URL segment of the group, shared by the routes, the SWR keys and the OpenAPI component names. */
export const CONFIRMATION_SETTINGS_KEY = 'confirmation';

/** The feature that gates the group: its routes, its card and every setting in it. */
export const CONFIRMATION_SCREEN_FEATURE = 'confirmation-screen';

/** What the confirmation screen offers a submitter. A save sends every setting in the group. */
export const ConfirmationSettingsSchema = z.object({
  allowSubmitterEmailCopy: z.boolean(),
  showConfirmationId: z.boolean(),
});
export type ConfirmationSettings = z.infer<typeof ConfirmationSettingsSchema>;
export type ConfirmationSetting = keyof ConfirmationSettings;

/**
 * The feature that gates each setting, on top of the group's. While it is off the setting is hidden
 * and has its default effect, whatever is stored.
 */
export const CONFIRMATION_SETTING_FEATURES: Readonly<Record<ConfirmationSetting, string>> = {
  allowSubmitterEmailCopy: 'confirmation-email-copy',
  showConfirmationId: 'confirmation-id-visibility',
};

export const CONFIRMATION_SETTINGS = Object.keys(
  CONFIRMATION_SETTING_FEATURES,
) as readonly ConfirmationSetting[];

/** Whether each setting's feature is available, the group's included. */
export type ConfirmationSettingAvailability = Readonly<Record<ConfirmationSetting, boolean>>;

/**
 * The values a save writes: each available setting as sent, each unavailable one as it is now, so
 * a save cannot change a setting that is hidden.
 */
export const keepUnavailableSettings = (
  sent: ConfirmationSettings,
  current: ConfirmationSettings,
  available: ConfirmationSettingAvailability,
): ConfirmationSettings => {
  const kept = { ...sent };
  for (const setting of CONFIRMATION_SETTINGS) {
    if (!available[setting]) kept[setting] = current[setting];
  }
  return kept;
};

const schemas = inheritableSettingsSchemas(ConfirmationSettingsSchema);

/** A workspace's confirmation settings, as read and as saved. */
export const WorkspaceConfirmationSettingsSchema = schemas.workspace;
export const FormConfirmationSettingsSchema = schemas.form;
export const SetFormConfirmationSettingsBodySchema = schemas.formBody;

export type WorkspaceConfirmationSettings = WorkspaceSettings<ConfirmationSettings>;
export type FormConfirmationSettings = InheritableSettings<ConfirmationSettings>;
export type SetFormConfirmationSettingsBody = SetInheritableSettingsBody<ConfirmationSettings>;
