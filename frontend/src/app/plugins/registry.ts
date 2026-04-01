import type { Locale } from '@/app/[lang]/dictionaries';
import { designModePlugin } from '@/src/features/design-mode/plugin';
import { metaReviewPlugin } from '@/src/features/meta-review/plugin';
import { submitModePlugin } from '@/src/features/submit-mode/plugin';
import { workspacesPlugin } from '@/src/features/workspaces/plugin';
import { designerPlugin } from '@/src/features/designer/plugin';
import { isFeatureEnabled } from '@/src/shared/featureFlags/flags';
import type { AppPlugin, PluginNavItem } from '@/src/app/plugins/types';

type Dictionary = {
  locale: string;
  header: {
    workspaces: string;
    designer: string;
    submit: string;
    metaReview?: string;
    themeToggle?: string;
  };
};

const allPlugins: AppPlugin[] = [
  workspacesPlugin,
  designerPlugin,
  submitModePlugin,
  metaReviewPlugin,
];

function getEnabledPlugins(isFeatureAllowed: (code: string) => boolean): AppPlugin[] {
  return allPlugins
    .filter(
      (plugin) => plugin.featureCode === undefined || isFeatureAllowed(plugin.featureCode),
    )
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

function navItemsFromPlugins(
  plugins: AppPlugin[],
  locale: Locale,
  dictionary: Dictionary,
): PluginNavItem[] {
  return plugins
    .map((plugin) => plugin.getNavItem({ locale, dictionary }))
    .filter((item): item is PluginNavItem => item !== null);
}

/** Horizontal header nav: excludes plugins with `showInHeaderNav: false`. */
export function getHeaderNavigationItems(
  locale: Locale,
  dictionary: Dictionary,
  isFeatureAllowed: (code: string) => boolean,
): PluginNavItem[] {
  const plugins = getEnabledPlugins(isFeatureAllowed).filter(
    (plugin) => plugin.showInHeaderNav !== false,
  );
  return navItemsFromPlugins(plugins, locale, dictionary);
}

/** Nav overlay menu: all enabled plugins. */
export function getOverlayNavigationItems(
  locale: Locale,
  dictionary: Dictionary,
  isFeatureAllowed: (code: string) => boolean,
): PluginNavItem[] {
  return navItemsFromPlugins(getEnabledPlugins(isFeatureAllowed), locale, dictionary);
}

export function getHomeSections(isFeatureAllowed: (code: string) => boolean) {
  return getEnabledPlugins(isFeatureAllowed).map((plugin) => ({
    id: plugin.id,
    Section: plugin.HomeSection,
  }));
}
