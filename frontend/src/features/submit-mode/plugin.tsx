import type { AppPlugin } from '@/src/types/plugins';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';

export const submitModePlugin: AppPlugin = {
  id: 'submit-mode',
  featureCode: FEATURE_CODES.SUBMIT_MODE,
  showInHeaderNav: false,
  order: 30,
  getNavItem: ({ locale, dictionary }) => ({
    id: 'submit-mode',
    href: `/${locale}/forms`,
    label: dictionary.header.submit,
  })
};
