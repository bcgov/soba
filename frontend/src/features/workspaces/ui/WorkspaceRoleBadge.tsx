'use client';

import { StatusTag, workspaceRoleToVariant } from '@/src/components/StatusTag';

type WorkspaceRoleBadgeProps = {
  role?: string;
  'data-testid'?: string;
};

function formatRoleLabel(role: string): string {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function WorkspaceRoleBadge({ role, 'data-testid': testId }: WorkspaceRoleBadgeProps) {
  const label = formatRoleLabel(role || '');
  const id = `workspace-role-${(role || 'unknown').toLowerCase()}-${testId ?? 'badge'}`;
  return (
    <StatusTag
      id={id}
      label={label}
      variant={workspaceRoleToVariant(role)}
      data-testid={testId}
    />
  );
}
