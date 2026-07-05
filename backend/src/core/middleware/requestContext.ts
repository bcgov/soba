/**
 * Core per-request workspace context, populated by the per-route workspace middleware in
 * `workspaceContext.ts` (`workspaceFromQuery` / `workspaceFromResource`). Actor-only routes
 * (e.g. GET /me, GET /workspaces) do not set this and read `req.actorId` directly.
 */
export interface CoreRequestContext {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  workspaceSource: string;
  /** The actor's workspace membership role (owner/admin/member/viewer); gates workspace management. */
  role: string;
}

/**
 * Scope for workspace-scoped *list/search* routes, populated by `workspaceListScope`. Workspace
 * is always resolved to a single id (from a scope anchor); membership is verified before listing.
 */
export interface CoreListScope {
  actorId: string;
  /** Workspaces the list is restricted to (always a single resolved workspace). */
  workspaceIds: string[];
  /** The workspace resolved from the scope anchor. */
  selectedWorkspaceId?: string;
}
