import type { AppPlugin } from '@/src/app/plugins/types';
import { FEATURE_KEYS } from '@/src/shared/featureFlags/flags';
import WorkspaceList from '@/src/features/workspaces/ui/WorkspaceList';

export const workspacesPlugin: AppPlugin = {
  id: 'workspaces',
  featureFlag: FEATURE_KEYS.workspaces,
  order: 10,
  getNavItem: ({ locale, dictionary }) => ({
    id: 'workspaces',
    href: `/${locale}/`,
    label: dictionary.header.workspaces,
  }),
  HomeSection: WorkspaceList,
};
