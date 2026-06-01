import type { AppPlugin } from '@/src/app/plugins/types';
import { EmptyHomeSection } from '@/src/app/plugins/EmptyHomeSection';

export const workspacesPlugin: AppPlugin = {
  id: 'workspaces',
  showInHeaderNav: false,
  order: 10,
  getNavItem: ({ locale, dictionary }) => ({
    id: 'workspaces',
    href: `/${locale}/`,
    label: dictionary.header.workspaces,
  }),
  HomeSection: EmptyHomeSection,
};
