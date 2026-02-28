export interface IdentitySyncAdapter {
  syncWorkspaceUser(workspaceId: string, userId: string): Promise<void>;
}
