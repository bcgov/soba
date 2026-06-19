/** Membership roles allowed to manage or create workspaces. */
export const WORKSPACE_MANAGE_ROLES = ['owner', 'admin'] as const;

export function isWorkspaceManageRole(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

export function userCanCreateWorkspace(workspaces: { role: string }[]): boolean {
  return workspaces.some((workspace) => isWorkspaceManageRole(workspace.role));
}
