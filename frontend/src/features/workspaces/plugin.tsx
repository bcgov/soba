import type { AppPlugin } from '@/src/types/plugins';

export const workspacesPlugin: AppPlugin = {
  id: 'workspaces',
  showInHeaderNav: false,
  order: 10,
  getNavItem: ({ locale, dictionary }) => ({
    id: 'workspaces',
    href: `/${locale}/workspaces`,
    label: dictionary.header.workspaces,
  }),
};
