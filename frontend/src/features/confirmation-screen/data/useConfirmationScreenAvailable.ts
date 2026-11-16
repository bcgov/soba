import { useId } from 'react';
import useSWR from 'swr';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';
import {
  fetchFeatureAvailability,
  type FeatureScopeQuery,
} from '@/src/shared/featureFlags/featureAvailability';
import {
  CONFIRMATION_SCREEN_FEATURE,
  CONFIRMATION_SETTING_FEATURES,
  CONFIRMATION_SETTINGS,
  type ConfirmationSettingAvailability,
} from '@/src/types/formSettings';

/** What the Confirmation Screen card can show for a workspace or a form. */
export interface ConfirmationScreenAvailability {
  /** Each setting whose feature, and the group's, is available. */
  settings: ConfirmationSettingAvailability;
  /** Email copies are sent only while notifications are on. */
  notifications: boolean;
}

const NOTHING: ConfirmationScreenAvailability = {
  settings: { allowSubmitterEmailCopy: false, showConfirmationId: false },
  notifications: false,
};

const readAvailability = async (
  scope: FeatureScopeQuery,
): Promise<ConfirmationScreenAvailability> => {
  const [group, notifications, ...settings] = await Promise.all([
    fetchFeatureAvailability(CONFIRMATION_SCREEN_FEATURE, scope),
    fetchFeatureAvailability(FEATURE_CODES.NOTIFICATIONS, scope),
    ...CONFIRMATION_SETTINGS.map((setting) =>
      fetchFeatureAvailability(CONFIRMATION_SETTING_FEATURES[setting], scope),
    ),
  ]);
  return {
    settings: Object.fromEntries(
      CONFIRMATION_SETTINGS.map((setting, index) => [setting, group && settings[index]]),
    ) as ConfirmationSettingAvailability,
    notifications,
  };
};

/** True when the card has a setting to show; undefined while that is not known. */
export const hasConfirmationSettings = (
  availability: ConfirmationScreenAvailability | undefined,
): boolean | undefined =>
  availability && CONFIRMATION_SETTINGS.some((setting) => availability.settings[setting]);

/**
 * What the Confirmation Screen card can show for a workspace, or for a form, which names its
 * workspace too in case a feature is scoped. Asked anew each time the caller mounts, as
 * usePostSubmissionAvailable is. Undefined while the checks run; nothing without a scope, and for
 * any check that fails.
 */
export function useConfirmationScreenAvailable(
  scope: { workspaceId: string; formId?: string } | null,
): ConfirmationScreenAvailability | undefined {
  const readId = useId();
  const { data } = useSWR(
    scope
      ? ['confirmation-screen-available', scope.workspaceId, scope.formId ?? null, readId]
      : null,
    () => readAvailability(scope ?? {}),
    sessionReadConfig,
  );
  return scope ? data : NOTHING;
}
