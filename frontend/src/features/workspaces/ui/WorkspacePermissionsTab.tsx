'use client';

import { AccordionGroup, Accordion } from '@bcgov/design-system-react-components';
import type { Dictionary } from '@/src/types/dictionary';
import WorkspaceRoleDrawer from './WorkspaceRoleDrawer';
import WorkspaceGroupDrawer from './WorkspaceGroupDrawer';
import WorkspaceAccessDrawer from './WorkspaceAccessDrawer';

export interface WorkspacePermissionsTabProps {
  dict: Dictionary;
  workspaceId: string;
}

export function WorkspacePermissionsTab({
  dict,
  workspaceId,
}: Readonly<WorkspacePermissionsTabProps>) {
  const t = dict.workspaces;

  return (
    <AccordionGroup allowsMultipleExpanded={false} defaultExpandedKeys={['workspace-roles']}>
      <Accordion id="workspace-roles" data-testid="accordion-workspace-roles" label={t.rolesTab}>
        <div className="d-block w-100">
          <WorkspaceRoleDrawer dict={dict} workspaceId={workspaceId} />
        </div>
      </Accordion>
      <Accordion id="workspace-groups" data-testid="accordion-workspace-groups" label={t.groupsTab}>
        <div className="d-block w-100">
          <WorkspaceGroupDrawer dict={dict} workspaceId={workspaceId} />
        </div>
      </Accordion>
      <Accordion id="workspace-access" data-testid="accordion-workspace-access" label={t.accessTab}>
        <div className="d-block w-100">
          <WorkspaceAccessDrawer dict={dict} workspaceId={workspaceId} />
        </div>
      </Accordion>
    </AccordionGroup>
  );
}

export default WorkspacePermissionsTab;
