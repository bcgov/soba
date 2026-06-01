import type { AppPlugin } from '@/src/app/plugins/types';
import { EmptyHomeSection } from '@/src/app/plugins/EmptyHomeSection';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';

export const submitModePlugin: AppPlugin = {
  id: 'submit-mode',
  featureCode: FEATURE_CODES.SUBMIT_MODE,
  showInHeaderNav: false,
  order: 30,
  getNavItem: ({ locale, dictionary }) => ({
    id: 'submit-mode',
    href: `/${locale}/submit`,
    label: dictionary.header.submit,
  }),
  HomeSection: EmptyHomeSection,
};
