'use client';

type WorkspaceRoleBadgeProps = {
  role?: string;
  'data-testid'?: string;
};

const ROLE_VARIANTS: Record<string, string> = {
  owner: 'text-bg-primary',
  admin: 'text-bg-info',
  member: 'text-bg-secondary',
  viewer: 'text-bg-light text-dark border',
};

function formatRoleLabel(role: string): string {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Membership role pill for the workspaces list. The role text is always
 * rendered (not color-only) for accessibility.
 */
export function WorkspaceRoleBadge({ role, 'data-testid': testId }: WorkspaceRoleBadgeProps) {
  const normalized = (role || '').toLowerCase();
  const variant = ROLE_VARIANTS[normalized] ?? 'text-bg-secondary';
  return (
    <span className={`badge rounded-pill ${variant}`} data-testid={testId}>
      {formatRoleLabel(role || '')}
    </span>
  );
}
