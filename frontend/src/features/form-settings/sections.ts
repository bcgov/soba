import useSWR from 'swr';
import { loadFeaturesMeta } from '@/src/shared/config/featuresMeta';
import { createIsFeatureAllowed } from '@/src/shared/featureFlags/flags';
import { fetchFeatureAvailability } from '@/src/shared/featureFlags/featureAvailability';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { formSettingsSections } from './registry';
import type { FormSettingsSection } from './types';

const hideAll = () => () => false;

/**
 * The ids of the sections available for a form. A scoped section asks the server about the form's
 * grant; a fixed one uses the deployment's feature flags. A check that fails hides its section.
 */
export async function resolveAvailableSectionIds(
  sections: FormSettingsSection[],
  scope: { workspaceId: string; formId: string },
): Promise<string[]> {
  const needsFlags = sections.some((section) => section.featureCode && !section.scoped);
  const isFeatureAllowed = needsFlags
    ? await loadFeaturesMeta().then(createIsFeatureAllowed, hideAll)
    : hideAll();

  const available = await Promise.all(
    sections.map(async (section) => {
      const code = section.featureCode;
      if (!code) return true;
      return section.scoped ? fetchFeatureAvailability(code, scope) : isFeatureAllowed(code);
    }),
  );
  return sections.filter((_, index) => available[index]).map((section) => section.id);
}

/** A form's Settings tab sections, lowest weight first, without those whose feature is off. */
export function useFormSettingsSections(
  formId: string,
  workspaceId: string | null,
): FormSettingsSection[] {
  const gated = formSettingsSections.filter((section) => section.featureCode);
  const { data: availableIds } = useSWR(
    gated.length > 0 && workspaceId ? ['form-settings-sections', workspaceId, formId] : null,
    () => resolveAvailableSectionIds(gated, { workspaceId: workspaceId as string, formId }),
    sessionReadConfig,
  );
  return formSettingsSections.filter(
    (section) => !section.featureCode || (availableIds ?? []).includes(section.id),
  );
}
