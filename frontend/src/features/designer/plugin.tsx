import type { AppPlugin } from '@/src/app/plugins/types';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';
import FormList from '@/src/features/designer/ui/FormList';

export const designerPlugin: AppPlugin = {
  id: 'form-designer',
  featureCode: FEATURE_CODES.DESIGN_MODE,
  showInHeaderNav: false,
  order: 20,
  getNavItem: ({ locale, dictionary }) => ({
    id: 'designer',
    href: `/${locale}/designer`,
    label: dictionary.header.designer,
  }),
  HomeSection: FormList,
};
