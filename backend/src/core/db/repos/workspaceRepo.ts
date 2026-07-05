import { and, eq, ne } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import {
  FORM_ADMINS_GROUP_NAME,
  FORM_SUBMITTERS_GROUP_NAME,
  Roles,
  SystemGroup,
  WorkspaceMembershipRole,
  WorkspaceMembershipSource,
} from '../codes';
import { db } from '../client';
import { appUsers, workspaceMemberships, workspaces } from '../schema';
import { ConflictError } from '../../errors';
import {
  getWorkspaceForUser,
  invalidateMembershipCache,
  isWorkspaceManageRole,
} from './membershipRepo';
import { addUserToGroup, createGroupWithRole } from './workspaceGroupRepo';

const WORKSPACE_KIND_TEAM = 'team';
const WORKSPACE_STATUS_ACTIVE = 'active';
const MEMBERSHIP_STATUS_ACTIVE = 'active';
const WORKSPACE_NAME_TAKEN = 'A workspace with this name already exists';

/** True if a workspace of this kind already uses this name (optionally excluding one workspace). */
const workspaceNameExistsForKind = async (
  kind: string,
  name: string,
  exceptId?: string,
): Promise<boolean> => {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.kind, kind),
        eq(workspaces.name, name),
        ...(exceptId ? [ne(workspaces.id, exceptId)] : []),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
};

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
    roleCodes: [Roles.form_admin],
    systemCode: SystemGroup.form_admins,
    displayLabel,
  });
  await addUserToGroup(tx, { workspaceId, groupId: formAdminsGroupId, membershipId, displayLabel });

  // Submitter group starts empty; members are added when submitter access is configured.
  await createGroupWithRole(tx, {
    workspaceId,
    name: FORM_SUBMITTERS_GROUP_NAME,
    roleCodes: [Roles.form_submitter],
    systemCode: SystemGroup.form_submitters,
    displayLabel,
  });

  invalidateMembershipCache(workspaceId, userId);
};

/**
 * Creates a user-owned team workspace: owner membership plus the form-admin and form-submitter groups.
 */
export const createTeamWorkspace = async (userId: string, name: string) => {
  if (await workspaceNameExistsForKind(WORKSPACE_KIND_TEAM, name)) {
    throw new ConflictError(WORKSPACE_NAME_TAKEN);
  }
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

  if (await workspaceNameExistsForKind(membership.kind, name, workspaceId)) {
    throw new ConflictError(WORKSPACE_NAME_TAKEN);
  }

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
