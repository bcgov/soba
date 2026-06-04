import type { Locale } from '@/app/[lang]/dictionaries';

export type Dictionary = {
  locale: string;
  header: {
    [x: string]: string | undefined;
    workspaces: string;
    designer: string;
    submit: string;
    metaReview?: string;
    themeToggle?: string;
  };
  metaPage?: {
    title: string;
    refresh: string;
    loadCodes: string;
    loadRoles: string;
    sections: {
      health: string;
      readiness: string;
      build: string;
      features: string;
      frontendConfig: string;
      plugins: string;
      formEngines: string;
      codes: string;
      roles: string;
    };
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
  /**
   * When false, the plugin’s nav item is omitted from the header’s primary bar (still shown in NavOverlay).
   * Default true when omitted.
   */
  showInHeaderNav?: boolean;
  order?: number;
  getNavItem: (params: { locale: Locale; dictionary: Dictionary }) => PluginNavItem | null;
};
