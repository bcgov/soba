import type { FormAccessFilter } from '../db/repos/formAccessRepo';

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
  /** The form the resolved resource belongs to, set whenever the resource is a form or under one. */
  formId?: string;
  /**
   * The actor's workspace membership role (owner/admin/member/viewer); gates workspace management.
   * Cached with the membership (see buildCoreContext); any role change must call
   * invalidateMembershipCache(workspaceId, userId) or a demoted admin keeps authority until the TTL.
   */
  role: string;
  /** The actor's permission codes on `formId`, or on the workspace without one. */
  permissions?: ReadonlySet<string>;
}

/**
 * Scope for *list/search* routes, populated by `workspaceListScope` and `requireFormPermissions`.
 * Membership in an anchored workspace is verified before listing.
 */
export interface CoreListScope {
  actorId: string;
  /** The anchored workspace, or every workspace the actor is an active member of. */
  workspaceIds: string[];
  /** The workspace resolved from the scope anchor. */
  selectedWorkspaceId?: string;
  /** Set when the list names no form: only rows whose form allows the actor are kept. */
  formAccess?: FormAccessFilter;
}
