import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import {
  rolePermissions,
  workspaceGroupMemberships,
  workspaceGroupRoles,
  workspaceMemberships,
} from '../schema';
import {
  GroupMemberKind,
  Permissions,
  WorkspaceGroupMembershipStatus,
  WorkspaceGroupRoleStatus,
  WorkspaceMembershipStatus,
} from '../codes';
import { getWorkspaceIdForForm } from './formRepo';

/**
 * Permission codes the user holds across a workspace's forms, from the roles of the workspace groups
 * they belong to. A returned set containing '*' grants everything. Resolves 'user' group members only.
 */
export const resolveFormPermissions = async (
  actorId: string,
  workspaceId: string,
): Promise<Set<string>> => {
  const rows = await db
    .selectDistinct({ permissionCode: rolePermissions.permissionCode })
    .from(workspaceGroupMemberships)
    .innerJoin(
      workspaceGroupRoles,
      eq(workspaceGroupRoles.groupId, workspaceGroupMemberships.groupId),
    )
    .innerJoin(rolePermissions, eq(rolePermissions.roleCode, workspaceGroupRoles.roleCode))
    .innerJoin(
      workspaceMemberships,
      eq(workspaceMemberships.id, workspaceGroupMemberships.workspaceMembershipId),
    )
    .where(
      and(
        eq(workspaceGroupMemberships.workspaceId, workspaceId),
        eq(workspaceGroupMemberships.memberKind, GroupMemberKind.user),
        eq(workspaceGroupMemberships.status, WorkspaceGroupMembershipStatus.active),
        eq(workspaceGroupRoles.status, WorkspaceGroupRoleStatus.active),
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, actorId),
        eq(workspaceMemberships.status, WorkspaceMembershipStatus.active),
      ),
    );

  return new Set(rows.map((row) => row.permissionCode));
};

/** Permission codes the user holds on a specific form, resolved via the form's workspace. */
export const effectiveFormPermissions = async (
  actorId: string,
  formId: string,
): Promise<Set<string>> => {
  const workspaceId = await getWorkspaceIdForForm(formId);
  if (!workspaceId) return new Set();
  return resolveFormPermissions(actorId, workspaceId);
};

/** True if `perms` satisfies every required code, honoring the `*` wildcard. */
export const hasAllPermissions = (perms: Set<string>, required: readonly string[]): boolean => {
  if (perms.has(Permissions.all)) return true;
  return required.every((code) => perms.has(code));
};
