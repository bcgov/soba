import type React from 'react';
import type { Locale } from '@/app/[lang]/dictionaries';
import type { FeatureKey } from '@/src/shared/featureFlags/flags';

type Dictionary = {
  locale: string;
  header: {
    [x: string]: string | undefined;
    workspaces: string;
    designer: string;
    themeToggle?: string | undefined;
  };
};

export type PluginNavItem = {
  id: string;
  href: string;
  label: string;
};

export type AppPlugin = {
  id: string;
  featureFlag: FeatureKey;
  order?: number;
  getNavItem: (params: { locale: Locale; dictionary: Dictionary }) => PluginNavItem | null;
  HomeSection: React.ComponentType;
};
