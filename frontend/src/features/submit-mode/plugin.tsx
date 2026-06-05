import type { AppPlugin } from '@/src/app/plugins/types';
import SubmissionList from '@/src/features/submit-mode/ui/SubmissionList';
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
  }),
  HomeSection: SubmissionList,
};
