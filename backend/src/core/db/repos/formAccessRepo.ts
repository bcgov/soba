import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import {
  rolePermissions,
  workspaceGroupMemberships,
  workspaceGroupRoles,
  workspaceMemberships,
} from '../schema';
import { GroupMemberKind, Permissions } from '../codes';
import { getWorkspaceIdForForm } from './formRepo';

const STATUS_ACTIVE = 'active';

/**
 * Permission codes the user holds on a form, resolved from the roles of the workspace groups they
 * belong to in the form's workspace. A returned set containing '*' grants everything. Resolves
 * 'user' group members only; other member kinds are ignored.
 */
export const effectiveFormPermissions = async (
  actorId: string,
  formId: string,
): Promise<Set<string>> => {
  const workspaceId = await getWorkspaceIdForForm(formId);
  if (!workspaceId) return new Set();

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
        eq(workspaceGroupMemberships.status, STATUS_ACTIVE),
        eq(workspaceGroupRoles.status, STATUS_ACTIVE),
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, actorId),
        eq(workspaceMemberships.status, STATUS_ACTIVE),
      ),
    );

  return new Set(rows.map((row) => row.permissionCode));
};

/** True if `perms` satisfies every required code, honoring the `*` wildcard. */
export const hasAllPermissions = (perms: Set<string>, required: readonly string[]): boolean => {
  if (perms.has(Permissions.all)) return true;
  return required.every((code) => perms.has(code));
};
