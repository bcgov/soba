'use client';

import { AccordionGroup } from '@bcgov/design-system-react-components';
import type { Dictionary } from '@/src/types/dictionary';
import { workspaceSettingsSections } from '../registry';

/** A workspace's Form Settings tab: the groups its forms share, each in its own drawer. */
export default function WorkspaceFormSettings({
  dict,
  workspaceId,
}: Readonly<{ dict: Dictionary; workspaceId: string }>) {
  return (
    <>
      <p data-testid="workspace-form-settings-intro">{dict.workspaces.formSettingsIntro}</p>
      <AccordionGroup
        allowsMultipleExpanded={false}
        defaultExpandedKeys={[workspaceSettingsSections[0].id]}
      >
        {workspaceSettingsSections.map(({ id, Drawer }) => (
          <Drawer key={id} drawerName={id} dict={dict} workspaceId={workspaceId} />
        ))}
      </AccordionGroup>
    </>
  );
}
