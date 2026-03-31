import type { AppPlugin } from '@/src/app/plugins/types';
import { EmptyHomeSection } from '@/src/app/plugins/EmptyHomeSection';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';

export const designModePlugin: AppPlugin = {
  id: 'design-mode',
  featureCode: FEATURE_CODES.DESIGN_MODE,
  showInHeaderNav: false,
  order: 20,
  getNavItem: ({ locale, dictionary }) => ({
    id: 'design-mode',
    href: `/${locale}/design`,
    label: dictionary.header.design,
  }),
  HomeSection: EmptyHomeSection,
};
