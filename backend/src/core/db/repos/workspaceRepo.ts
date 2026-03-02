import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db } from '../client';
import { appUsers, workspaces, workspaceMemberships } from '../schema';
import { invalidateMembershipCache } from './membershipRepo';

export const ensureHomeWorkspace = async (userId: string) => {
  const existing = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(
      workspaceMemberships,
      and(
        eq(workspaceMemberships.workspaceId, workspaces.id),
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.role, 'owner'),
        eq(workspaceMemberships.source, 'auto_home'),
      ),
    )
    .where(and(eq(workspaces.kind, 'personal'), eq(workspaces.ownerUserId, userId)))
    .limit(1);

  if (existing[0]) {
    return existing[0].id;
  }

  const userRow = await db
    .select({ displayLabel: appUsers.displayLabel })
    .from(appUsers)
    .where(eq(appUsers.id, userId))
    .limit(1);
  const displayLabel = userRow[0]?.displayLabel ?? null;

  const workspaceId = uuidv7();
  await db.insert(workspaces).values({
    id: workspaceId,
    kind: 'personal',
    name: 'Personal Workspace',
    status: 'active',
    ownerUserId: userId,
    createdBy: displayLabel,
    updatedBy: displayLabel,
  });

  await db.insert(workspaceMemberships).values({
    id: uuidv7(),
    workspaceId,
    userId,
    role: 'owner',
    status: 'active',
    source: 'auto_home',
    acceptedAt: new Date(),
    createdBy: displayLabel,
    updatedBy: displayLabel,
  });

  invalidateMembershipCache(workspaceId, userId);
  return workspaceId;
};
