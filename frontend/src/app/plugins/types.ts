import type React from 'react';
import type { Locale } from '@/app/[lang]/dictionaries';

type Dictionary = {
  locale: string;
  header: {
    workspaces: string;
    themeToggle?: string;
  };
};

export type PluginNavItem = {
  id: string;
  href: string;
  label: string;
};

export type AppPlugin = {
  id: string;
  /**
   * When set, the plugin is included only if `isFeatureAllowed(featureCode)` is true
   * (platform + `NEXT_PUBLIC_SOBA_FEATURES_ALLOWED`). Omit for always-on shell (e.g. workspaces).
   */
  featureCode?: string;
  order?: number;
  getNavItem: (params: { locale: Locale; dictionary: Dictionary }) => PluginNavItem | null;
  HomeSection: React.ComponentType;
};
