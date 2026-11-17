import {
  CONFIRMATION_SCREEN_FEATURE,
  CONFIRMATION_SETTING_FEATURES,
  CONFIRMATION_SETTINGS,
  type ConfirmationSetting,
  type ConfirmationSettingAvailability,
} from '@soba/lib';
import {
  isFeatureAvailable,
  type FeatureScopeContext,
} from '../../../core/services/featureAvailabilityService';

/** True when the group's feature and the setting's own are both available for the scope. */
export const isConfirmationSettingAvailable = async (
  setting: ConfirmationSetting,
  scope: FeatureScopeContext,
): Promise<boolean> =>
  (await isFeatureAvailable(CONFIRMATION_SCREEN_FEATURE, scope)) &&
  isFeatureAvailable(CONFIRMATION_SETTING_FEATURES[setting], scope);

/** Each confirmation setting's availability for the scope. */
export const confirmationSettingAvailability = async (
  scope: FeatureScopeContext,
): Promise<ConfirmationSettingAvailability> => {
  const available = await Promise.all(
    CONFIRMATION_SETTINGS.map((setting) => isConfirmationSettingAvailable(setting, scope)),
  );
  return Object.fromEntries(
    CONFIRMATION_SETTINGS.map((setting, index) => [setting, available[index]]),
  ) as ConfirmationSettingAvailability;
};
