import type { AppPlugin } from '@/src/app/plugins/types';
import { FEATURE_KEYS } from '@/src/shared/featureFlags/flags';
import FormList from '@/src/features/designer/ui/FormList';

export const designerPlugin: AppPlugin = {
  id: 'form-designer',
  featureFlag: FEATURE_KEYS.designer,
  order: 10,
  getNavItem: ({ locale, dictionary }) => ({
    id: 'designer',
    href: `/${locale}/designer`,
    label: dictionary.header.designer,
  }),
  HomeSection: FormList,
};
