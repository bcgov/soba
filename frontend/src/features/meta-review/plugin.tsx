import type { AppPlugin } from '@/src/types/plugins';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';

export const metaReviewPlugin: AppPlugin = {
  id: 'meta-review',
  featureCode: FEATURE_CODES.META,
  showInHeaderNav: false,
  order: 40,
  getNavItem: ({ locale, dictionary }) => {
    const label = dictionary.header.metaReview;
    if (!label) return null;
    return {
      id: 'meta-review',
      href: `/${locale}/meta`,
      label,
    };
  }
};
