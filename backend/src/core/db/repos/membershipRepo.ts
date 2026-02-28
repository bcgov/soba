import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db } from '../client';
import {
  appUsers,
  identityProviders,
  userIdentities,
  workspaceMemberships,
  workspaces,
} from '../schema';

export const findOrCreateUserByIdentity = async (
  providerCode: string,
  subject: string,
  profile?: { displayName?: string; email?: string },
) => {
  const normalizedProvider = providerCode.toLowerCase();
  const providerRow = await db
    .select()
    .from(identityProviders)
    .where(eq(identityProviders.code, normalizedProvider))
    .limit(1);
  let provider = providerRow[0];

  if (!provider) {
    const created = await db
      .insert(identityProviders)
      .values({
        id: uuidv7(),
        code: normalizedProvider,
        name: normalizedProvider.toUpperCase(),
        isActive: true,
      })
      .returning();
    provider = created[0];
  }

  const row = await db
    .select({ userId: userIdentities.userId })
    .from(userIdentities)
    .where(
      and(eq(userIdentities.identityProviderId, provider.id), eq(userIdentities.subject, subject)),
    )
    .limit(1);

  if (row[0]) {
    return row[0].userId;
  }

  const createdUser = await db
    .insert(appUsers)
    .values({
      id: uuidv7(),
      displayName: profile?.displayName ?? subject,
      email: profile?.email ?? null,
      status: 'active',
    })
    .returning({ id: appUsers.id });

  const userId = createdUser[0].id;

  await db.insert(userIdentities).values({
    id: uuidv7(),
    userId,
    identityProviderId: provider.id,
    subject,
  });

  return userId;
};

export const actorBelongsToWorkspace = async (workspaceId: string, userId: string) => {
  const row = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.status, 'active'),
      ),
    )
    .limit(1);

  return Boolean(row[0]);
};

export const getWorkspaceForUser = async (workspaceId: string, userId: string) => {
  const row = await db
    .select({
      id: workspaces.id,
      kind: workspaces.kind,
      name: workspaces.name,
      membershipId: workspaceMemberships.id,
      role: workspaceMemberships.role,
    })
    .from(workspaces)
    .innerJoin(
      workspaceMemberships,
      and(
        eq(workspaceMemberships.workspaceId, workspaces.id),
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.status, 'active'),
      ),
    )
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  return row[0] ?? null;
};

export const listWorkspacesForUser = async (userId: string) => {
  return db
    .select({
      workspaceId: workspaces.id,
      name: workspaces.name,
      kind: workspaces.kind,
      role: workspaceMemberships.role,
      status: workspaces.status,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .where(and(eq(workspaceMemberships.userId, userId), eq(workspaceMemberships.status, 'active')));
};
