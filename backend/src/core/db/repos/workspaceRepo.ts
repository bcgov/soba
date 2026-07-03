import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import {
  FORM_ADMINS_GROUP_NAME,
  FORM_SUBMITTERS_GROUP_NAME,
  Roles,
  WorkspaceMembershipRole,
  WorkspaceMembershipSource,
} from '../codes';
import { db } from '../client';
import {
  appUsers,
  workspaceGroupMemberships,
  workspaceGroupRoles,
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

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Creates a workspace group carrying a single role; returns the new group id. */
const createGroupWithRole = async (
  tx: DbTx,
  args: { workspaceId: string; name: string; roleCode: string; displayLabel: string | null },
): Promise<string> => {
  const groupId = uuidv7();
  await tx.insert(workspaceGroups).values({
    id: groupId,
    workspaceId: args.workspaceId,
    name: args.name,
    status: GROUP_STATUS_ACTIVE,
    createdBy: args.displayLabel,
    updatedBy: args.displayLabel,
  });
  await tx.insert(workspaceGroupRoles).values({
    id: uuidv7(),
    workspaceId: args.workspaceId,
    groupId,
    roleCode: args.roleCode,
    status: GROUP_STATUS_ACTIVE,
    createdBy: args.displayLabel,
    updatedBy: args.displayLabel,
  });
  return groupId;
};

/** Adds a workspace member (by membership id) to a group. */
const addUserToGroup = async (
  tx: DbTx,
  args: { workspaceId: string; groupId: string; membershipId: string; displayLabel: string | null },
) => {
  await tx.insert(workspaceGroupMemberships).values({
    id: uuidv7(),
    workspaceId: args.workspaceId,
    workspaceMembershipId: args.membershipId,
    groupId: args.groupId,
    status: MEMBERSHIP_STATUS_ACTIVE,
    createdBy: args.displayLabel,
    updatedBy: args.displayLabel,
  });
};

const bootstrapWorkspaceOwner = async (
  tx: DbTx,
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

  const formAdminsGroupId = await createGroupWithRole(tx, {
    workspaceId,
    name: FORM_ADMINS_GROUP_NAME,
    roleCode: Roles.form_admin,
    displayLabel,
  });
  await addUserToGroup(tx, { workspaceId, groupId: formAdminsGroupId, membershipId, displayLabel });

  // Submitter group starts empty; members are added when submitter access is configured.
  await createGroupWithRole(tx, {
    workspaceId,
    name: FORM_SUBMITTERS_GROUP_NAME,
    roleCode: Roles.form_submitter,
    displayLabel,
  });

  invalidateMembershipCache(workspaceId, userId);
};

/**
 * Creates a user-owned team workspace: owner membership plus the form-admin and form-submitter groups.
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
