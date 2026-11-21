'use client';

import { AccordionGroup } from '@bcgov/design-system-react-components';
import type { Dictionary } from '@/src/types/dictionary';
import WorkspaceRoleDrawer from './WorkspaceRoleDrawer';
import WorkspaceGroupDrawer from './WorkspaceGroupDrawer';
import WorkspaceAccessDrawer from './WorkspaceAccessDrawer';

export interface WorkspacePermissionsTabProps {
  dict: Dictionary;
  workspaceId: string;
}

/** A workspace's Permissions tab: a drawer each for its people, groups and roles. */
export function WorkspacePermissionsTab({
  dict,
  workspaceId,
}: Readonly<WorkspacePermissionsTabProps>) {
  return (
    <AccordionGroup allowsMultipleExpanded={false} defaultExpandedKeys={['workspace-access']}>
      <WorkspaceAccessDrawer dict={dict} drawerName="workspace-access" workspaceId={workspaceId} />
      <WorkspaceGroupDrawer dict={dict} drawerName="workspace-groups" workspaceId={workspaceId} />
      <WorkspaceRoleDrawer dict={dict} drawerName="workspace-roles" workspaceId={workspaceId} />
    </AccordionGroup>
  );
}

export default WorkspacePermissionsTab;
