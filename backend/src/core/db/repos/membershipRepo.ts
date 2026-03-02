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
import { getCacheAdapter } from '../../integrations/plugins/PluginRegistry';
import { membershipKey } from '../../integrations/cache/cacheKeys';
import { profileHelpers } from '../../auth/jwtClaims';
import type { NormalizedProfile, IdpAttributes } from '../../auth/jwtClaims';

/**
 * Returns the app_user id for the given identity (provider code + subject), or null if not found.
 * Used to resolve the system user by SOBA_SYSTEM_SUBJECT (provider=system).
 */
export async function findUserIdByIdentity(
  providerCode: string,
  subject: string,
): Promise<string | null> {
  const normalizedCode = providerCode.toLowerCase();
  const row = await db
    .select({ userId: userIdentities.userId })
    .from(userIdentities)
    .where(
      and(
        eq(userIdentities.identityProviderCode, normalizedCode),
        eq(userIdentities.subject, subject),
      ),
    )
    .limit(1);
  return row[0]?.userId ?? null;
}

export const findOrCreateUserByIdentity = async (
  providerCode: string,
  subject: string,
  profile?: NormalizedProfile | null,
  idpAttributes?: IdpAttributes | null,
) => {
  return db.transaction(async (tx) => {
    const normalizedProvider = providerCode.toLowerCase();
    const providerRow = await tx
      .select()
      .from(identityProviders)
      .where(eq(identityProviders.code, normalizedProvider))
      .limit(1);
    let provider = providerRow[0];

    if (!provider) {
      const created = await tx
        .insert(identityProviders)
        .values({
          code: normalizedProvider,
          name: normalizedProvider.toUpperCase(),
          isActive: true,
        })
        .returning();
      provider = created[0];
    }

    const existing = await tx
      .select({ userId: userIdentities.userId, id: userIdentities.id })
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.identityProviderCode, provider.code),
          eq(userIdentities.subject, subject),
        ),
      )
      .limit(1);

    const existingRow = existing[0];

    if (existingRow) {
      const updates: { idpAttributes?: IdpAttributes; updatedAt: Date } = { updatedAt: new Date() };
      if (idpAttributes != null) updates.idpAttributes = idpAttributes;
      if (updates.idpAttributes != null) {
        await tx.update(userIdentities).set(updates).where(eq(userIdentities.id, existingRow.id));
      }
      return existingRow.userId;
    }

    const displayLabel = profileHelpers.getDisplayLabel(profile, subject) ?? subject;
    const createdUser = await tx
      .insert(appUsers)
      .values({
        id: uuidv7(),
        displayLabel,
        profile: profile ?? { displayName: subject },
        status: 'active',
        createdBy: displayLabel,
        updatedBy: displayLabel,
      })
      .returning({ id: appUsers.id });

    const userId = createdUser[0].id;

    await tx.insert(userIdentities).values({
      id: uuidv7(),
      userId,
      identityProviderCode: provider.code,
      subject,
      idpAttributes: idpAttributes ?? undefined,
      createdBy: displayLabel,
      updatedBy: displayLabel,
    });

    return userId;
  });
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

/**
 * Invalidate cached membership for a workspace/user after insert/update/delete.
 * Call from code that mutates workspace memberships (e.g. workspaceRepo, seed).
 */
export const invalidateMembershipCache = (workspaceId: string, userId: string): void => {
  try {
    getCacheAdapter().delete(membershipKey(workspaceId, userId));
  } catch {
    // Cache adapter may not be available (e.g. during seed before full app init).
  }
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
