import { and, desc, eq, lt, or } from 'drizzle-orm';
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
import { getSystemUser } from '../../services/systemUser';
import { profileHelpers } from '../../auth/jwtClaims';
import type { NormalizedProfile, IdpAttributes } from '../../auth/jwtClaims';

export { findUserIdByIdentity } from './identityLookup';

export const findOrCreateUserByIdentity = async (
  providerCode: string,
  subject: string,
  profile?: NormalizedProfile | null,
  idpAttributes?: IdpAttributes | null,
) => {
  const systemUser = await getSystemUser();
  const systemDisplayLabel = systemUser?.displayLabel ?? null;

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
          createdBy: systemDisplayLabel,
          updatedBy: systemDisplayLabel,
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
      slug: workspaces.slug,
      status: workspaces.status,
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

export type WorkspaceListSort = 'id:desc' | 'updatedAt:desc';
export type WorkspaceListCursorMode = 'id' | 'ts_id';

export interface ListWorkspacesForUserInput {
  userId: string;
  limit: number;
  sort: WorkspaceListSort;
  cursorMode: WorkspaceListCursorMode;
  afterId?: string;
  afterUpdatedAt?: Date;
  kind?: string;
  status?: string;
}

export interface WorkspaceListRow {
  id: string;
  name: string;
  slug: string | null;
  kind: string;
  role: string;
  status: string;
  updatedAt: Date;
}

export const listWorkspacesForUser = async (
  input: ListWorkspacesForUserInput,
): Promise<{ items: WorkspaceListRow[]; hasMore: boolean }> => {
  const whereClauses = [
    eq(workspaceMemberships.userId, input.userId),
    eq(workspaceMemberships.status, 'active'),
  ];
  if (input.kind) {
    whereClauses.push(eq(workspaces.kind, input.kind));
  }
  if (input.status) {
    whereClauses.push(eq(workspaces.status, input.status));
  }
  if (input.cursorMode === 'id' && input.afterId) {
    whereClauses.push(lt(workspaces.id, input.afterId));
  }
  if (input.cursorMode === 'ts_id' && input.afterId && input.afterUpdatedAt) {
    whereClauses.push(
      or(
        lt(workspaces.updatedAt, input.afterUpdatedAt),
        and(eq(workspaces.updatedAt, input.afterUpdatedAt), lt(workspaces.id, input.afterId)),
      ),
    );
  }

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      kind: workspaces.kind,
      role: workspaceMemberships.role,
      status: workspaces.status,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .where(and(...whereClauses))
    .orderBy(
      input.cursorMode === 'ts_id' || input.sort === 'updatedAt:desc'
        ? desc(workspaces.updatedAt)
        : desc(workspaces.id),
      desc(workspaces.id),
    )
    .limit(input.limit + 1);

  return {
    items: rows.slice(0, input.limit),
    hasMore: rows.length > input.limit,
  };
};

export interface WorkspaceMemberRow {
  id: string;
  userId: string;
  displayLabel: string | null;
  role: string;
  status: string;
  updatedAt: Date;
}

export type MemberListSort = 'id:desc' | 'updatedAt:desc';
export type MemberListCursorMode = 'id' | 'ts_id';

export interface ListMembersForWorkspaceInput {
  workspaceId: string;
  limit: number;
  sort: MemberListSort;
  cursorMode: MemberListCursorMode;
  afterId?: string;
  afterUpdatedAt?: Date;
  role?: string;
  status?: string;
}

export const listMembersForWorkspace = async (
  input: ListMembersForWorkspaceInput,
): Promise<{ items: WorkspaceMemberRow[]; hasMore: boolean }> => {
  const whereClauses = [eq(workspaceMemberships.workspaceId, input.workspaceId)];
  if (input.role) {
    whereClauses.push(eq(workspaceMemberships.role, input.role));
  }
  if (input.status) {
    whereClauses.push(eq(workspaceMemberships.status, input.status));
  }
  if (input.cursorMode === 'id' && input.afterId) {
    whereClauses.push(lt(workspaceMemberships.id, input.afterId));
  }
  if (input.cursorMode === 'ts_id' && input.afterId && input.afterUpdatedAt) {
    whereClauses.push(
      or(
        lt(workspaceMemberships.updatedAt, input.afterUpdatedAt),
        and(
          eq(workspaceMemberships.updatedAt, input.afterUpdatedAt),
          lt(workspaceMemberships.id, input.afterId),
        ),
      ),
    );
  }

  const rows = await db
    .select({
      id: workspaceMemberships.id,
      userId: workspaceMemberships.userId,
      displayLabel: appUsers.displayLabel,
      role: workspaceMemberships.role,
      status: workspaceMemberships.status,
      updatedAt: workspaceMemberships.updatedAt,
    })
    .from(workspaceMemberships)
    .innerJoin(appUsers, eq(appUsers.id, workspaceMemberships.userId))
    .where(and(...whereClauses))
    .orderBy(
      input.cursorMode === 'ts_id' || input.sort === 'updatedAt:desc'
        ? desc(workspaceMemberships.updatedAt)
        : desc(workspaceMemberships.id),
      desc(workspaceMemberships.id),
    )
    .limit(input.limit + 1);

  return {
    items: rows.slice(0, input.limit),
    hasMore: rows.length > input.limit,
  };
};
