import { and, eq } from 'drizzle-orm';
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
import {
  getWorkspaceForUser,
  invalidateMembershipCache,
  isWorkspaceManageRole,
} from './membershipRepo';

const WORKSPACE_KIND_TEAM = 'team';
const WORKSPACE_STATUS_ACTIVE = 'active';
const GROUP_STATUS_ACTIVE = 'active';
const MEMBERSHIP_STATUS_ACTIVE = 'active';

/** Returns the workspace's id if it exists, otherwise null. Used to distinguish 404 from 403. */
export const getWorkspaceById = async (workspaceId: string): Promise<{ id: string } | null> => {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return rows[0] ?? null;
};

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

const bootstrapWorkspaceOwner = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  workspaceId: string,
  userId: string,
  displayLabel: string | null,
  source: string,
) => {
  const membershipId = uuidv7();
  await tx.insert(workspaceMemberships).values({
    id: membershipId,
    workspaceId,
    userId,
    role: WorkspaceMembershipRole.owner,
    status: MEMBERSHIP_STATUS_ACTIVE,
    source,
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
};

/**
 * Creates a user-owned team workspace with owner membership and owners group.
 */
export const createTeamWorkspace = async (userId: string, name: string) => {
  return db.transaction(async (tx) => {
    const userRow = await tx
      .select({ displayLabel: appUsers.displayLabel })
      .from(appUsers)
      .where(eq(appUsers.id, userId))
      .limit(1);
    const displayLabel = userRow[0]?.displayLabel ?? null;

    const workspaceId = uuidv7();
    await tx.insert(workspaces).values({
      id: workspaceId,
      kind: WORKSPACE_KIND_TEAM,
      name,
      status: WORKSPACE_STATUS_ACTIVE,
      createdBy: displayLabel,
      updatedBy: displayLabel,
    });

    await bootstrapWorkspaceOwner(
      tx,
      workspaceId,
      userId,
      displayLabel,
      WorkspaceMembershipSource.user_created,
    );

    return workspaceId;
  });
};

/**
 * Renames a workspace when the actor is in the owners group.
 */
export const updateWorkspaceName = async (
  workspaceId: string,
  actorId: string,
  name: string,
): Promise<boolean> => {
  const membership = await getWorkspaceForUser(workspaceId, actorId);
  if (!membership || !isWorkspaceManageRole(membership.role)) return false;

  const userRow = await db
    .select({ displayLabel: appUsers.displayLabel })
    .from(appUsers)
    .where(eq(appUsers.id, actorId))
    .limit(1);
  const displayLabel = userRow[0]?.displayLabel ?? null;

  const rows = await db
    .update(workspaces)
    .set({ name, updatedBy: displayLabel, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
    .returning({ id: workspaces.id });

  return rows.length > 0;
};
