import type { AppPlugin } from '@/src/types/plugins';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';


export const designerPlugin: AppPlugin = {
  id: 'form-designer',
  featureCode: FEATURE_CODES.DESIGN_MODE,
  showInHeaderNav: false,
  order: 20,
  getNavItem: ({ locale, dictionary }) => ({
    id: 'designer',
    href: `/${locale}/designer`,
    label: dictionary.header.designer,
  })
};
