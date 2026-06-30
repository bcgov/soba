'use client';

import { Select } from '@bcgov/design-system-react-components';

export type WorkspaceSelectorItem = { id: string; name: string; kind: string };

export function WorkspaceSelector({
  workspaces,
  activeWorkspaceId,
  label,
  onChange,
}: Readonly<{
  workspaces: WorkspaceSelectorItem[];
  activeWorkspaceId: string | null;
  label: string;
  onChange: (key: string | number | null) => void;
}>) {
  return (
    <Select
      size="small"
      id="workspace-select"
      data-testid="workspace-select"
      aria-label={label}
      className="mr-2"
      selectedKey={activeWorkspaceId || null}
      onSelectionChange={onChange}
      items={workspaces.map((ws) => ({ id: ws.id, label: `${ws.name} (${ws.kind})` }))}
    />
  );
}
