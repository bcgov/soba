'use client';

import { Accordion } from '@bcgov/design-system-react-components';
import ApiKeys from '@/src/features/credentials/ui/ApiKeys';
import type { WorkspaceSettingsSectionProps } from '../types';

/** A key collection uses its own create form and one-time secret dialog. */
export default function WorkspaceApiKeyDrawer({
  dict,
  drawerName,
  workspaceId,
}: WorkspaceSettingsSectionProps) {
  return (
    <Accordion id={drawerName} data-testid={`accordion-${drawerName}`} label={dict.apiKeys.heading}>
      <div className="d-block w-100">
        <p>{dict.apiKeys.workspaceScope}</p>
        <ApiKeys scope={{ kind: 'workspace', id: workspaceId }} />
      </div>
    </Accordion>
  );
}
