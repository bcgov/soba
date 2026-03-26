import { and, eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import {
  Roles,
  WORKSPACE_OWNERS_GROUP_NAME,
  WorkspaceMembershipRole,
  WorkspaceMembershipSource,
  WorkspaceMembershipStatus,
} from '../codes';
import { db } from '../client';
import {
  appUsers,
  workspaceGroupMemberships,
  workspaceGroups,
  workspaceMemberships,
  workspaces,
} from '../schema';
import { invalidateMembershipCache } from './membershipRepo';

const WORKSPACE_KIND_PERSONAL = 'personal';
const WORKSPACE_STATUS_ACTIVE = 'active';
const GROUP_STATUS_ACTIVE = 'active';
const MEMBERSHIP_STATUS_ACTIVE = 'active';

/** Second int for `pg_advisory_xact_lock`; must not collide with other repo lock pairs (e.g. membership). */
const ADV_LOCK_ENSURE_HOME_WORKSPACE = 1_892_478_311;

/**
 * Returns the workspace group that confers the workspace-owner role, if present.
 */
export const getWorkspaceOwnersGroup = async (workspaceId: string) => {
  const rows = await db
    .select()
    .from(workspaceGroups)
    .where(
      and(
        eq(workspaceGroups.workspaceId, workspaceId),
        eq(workspaceGroups.roleCode, Roles.workspace_owner),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
};

/**
 * True if the actor is in this workspace's owners group (or is a platform admin, not implemented).
 * Use when enforcing: only workspace owners can add/remove members from the owners group.
 */
export const canManageWorkspaceOwners = async (
  workspaceId: string,
  actorId: string,
): Promise<boolean> => {
  const ownersGroup = await getWorkspaceOwnersGroup(workspaceId);
  if (!ownersGroup) return false;
  const rows = await db
    .select({ id: workspaceGroupMemberships.id })
    .from(workspaceGroupMemberships)
    .innerJoin(
      workspaceMemberships,
      and(
        eq(workspaceMemberships.id, workspaceGroupMemberships.workspaceMembershipId),
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, actorId),
        eq(workspaceMemberships.status, WorkspaceMembershipStatus.active),
      ),
    )
    .where(
      and(
        eq(workspaceGroupMemberships.workspaceId, workspaceId),
        eq(workspaceGroupMemberships.groupId, ownersGroup.id),
        eq(workspaceGroupMemberships.status, MEMBERSHIP_STATUS_ACTIVE),
      ),
    )
    .limit(1);
  return rows.length > 0;
};

/**
 * Ensures the user has a personal workspace where they are in the owners group.
 * If none exists, creates workspace, membership (owner, auto_home), owners group, and group membership.
 * Serialized per user so concurrent API calls cannot create duplicate home workspaces.
 */
export const ensureHomeWorkspace = async (userId: string) => {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${userId}::text), ${ADV_LOCK_ENSURE_HOME_WORKSPACE})`,
    );

    const existing = await tx
      .select({
        workspaceId: workspaces.id,
        source: workspaceMemberships.source,
      })
      .from(workspaces)
      .innerJoin(
        workspaceMemberships,
        and(
          eq(workspaceMemberships.workspaceId, workspaces.id),
          eq(workspaceMemberships.userId, userId),
          eq(workspaceMemberships.status, WorkspaceMembershipStatus.active),
        ),
      )
      .innerJoin(
        workspaceGroupMemberships,
        and(
          eq(workspaceGroupMemberships.workspaceId, workspaces.id),
          eq(workspaceGroupMemberships.workspaceMembershipId, workspaceMemberships.id),
        ),
      )
      .innerJoin(
        workspaceGroups,
        and(
          eq(workspaceGroups.id, workspaceGroupMemberships.groupId),
          eq(workspaceGroups.workspaceId, workspaces.id),
          eq(workspaceGroups.roleCode, Roles.workspace_owner),
        ),
      )
      .where(eq(workspaces.kind, WORKSPACE_KIND_PERSONAL));

    const preferred = existing.find((r) => r.source === WorkspaceMembershipSource.auto_home);
    const found = preferred ?? existing[0];
    if (found) {
      return found.workspaceId;
    }

    const userRow = await tx
      .select({ displayLabel: appUsers.displayLabel })
      .from(appUsers)
      .where(eq(appUsers.id, userId))
      .limit(1);
    const displayLabel = userRow[0]?.displayLabel ?? null;

    const workspaceId = uuidv7();
    await tx.insert(workspaces).values({
      id: workspaceId,
      kind: WORKSPACE_KIND_PERSONAL,
      name: 'Personal Workspace',
      status: WORKSPACE_STATUS_ACTIVE,
      createdBy: displayLabel,
      updatedBy: displayLabel,
    });

    const membershipId = uuidv7();
    await tx.insert(workspaceMemberships).values({
      id: membershipId,
      workspaceId,
      userId,
      role: WorkspaceMembershipRole.owner,
      status: MEMBERSHIP_STATUS_ACTIVE,
      source: WorkspaceMembershipSource.auto_home,
      acceptedAt: new Date(),
      createdBy: displayLabel,
      updatedBy: displayLabel,
    });

    const ownersGroupId = uuidv7();
    await tx.insert(workspaceGroups).values({
      id: ownersGroupId,
      workspaceId,
      name: WORKSPACE_OWNERS_GROUP_NAME,
      status: GROUP_STATUS_ACTIVE,
      roleCode: Roles.workspace_owner,
      createdBy: displayLabel,
      updatedBy: displayLabel,
    });

    await tx.insert(workspaceGroupMemberships).values({
      id: uuidv7(),
      workspaceId,
      workspaceMembershipId: membershipId,
      groupId: ownersGroupId,
      status: MEMBERSHIP_STATUS_ACTIVE,
      createdBy: displayLabel,
      updatedBy: displayLabel,
    });

    invalidateMembershipCache(workspaceId, userId);
    return workspaceId;
  });
};
