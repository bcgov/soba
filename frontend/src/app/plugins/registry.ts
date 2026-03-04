import type { Locale } from '@/app/[lang]/dictionaries';
import { workspacesPlugin } from '@/src/features/workspaces/plugin';
import { isFeatureEnabled } from '@/src/shared/featureFlags/flags';
import type { AppPlugin, PluginNavItem } from '@/src/app/plugins/types';

type Dictionary = {
  locale: string;
  header: {
    workspaces: string;
    themeToggle?: string;
  };
};

const allPlugins: AppPlugin[] = [workspacesPlugin];

function getEnabledPlugins(): AppPlugin[] {
  return allPlugins
    .filter((plugin) => isFeatureEnabled(plugin.featureFlag))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

export function getNavigationItems(locale: Locale, dictionary: Dictionary): PluginNavItem[] {
  return getEnabledPlugins()
    .map((plugin) => plugin.getNavItem({ locale, dictionary }))
    .filter((item): item is PluginNavItem => item !== null);
}

export function getHomeSections() {
  return getEnabledPlugins().map((plugin) => ({
    id: plugin.id,
    Section: plugin.HomeSection,
  }));
}
