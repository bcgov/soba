import type { Locale } from '@/app/[lang]/dictionaries';
import { workspacesPlugin } from '@/src/features/workspaces/plugin';
import type { AppPlugin, PluginNavItem } from '@/src/app/plugins/types';

type Dictionary = {
  locale: string;
  header: {
    workspaces: string;
    themeToggle?: string;
  };
};

const allPlugins: AppPlugin[] = [workspacesPlugin];

function getEnabledPlugins(isFeatureAllowed: (code: string) => boolean): AppPlugin[] {
  return allPlugins
    .filter(
      (plugin) => plugin.featureCode === undefined || isFeatureAllowed(plugin.featureCode),
    )
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

export function getNavigationItems(
  locale: Locale,
  dictionary: Dictionary,
  isFeatureAllowed: (code: string) => boolean,
): PluginNavItem[] {
  return getEnabledPlugins(isFeatureAllowed)
    .map((plugin) => plugin.getNavItem({ locale, dictionary }))
    .filter((item): item is PluginNavItem => item !== null);
}

export function getHomeSections(isFeatureAllowed: (code: string) => boolean) {
  return getEnabledPlugins(isFeatureAllowed).map((plugin) => ({
    id: plugin.id,
    Section: plugin.HomeSection,
  }));
}
