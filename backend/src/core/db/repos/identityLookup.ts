import { and, eq, sql } from 'drizzle-orm';
import { db } from '../client';
import { identityProviders, sobaAdmins, userIdentities } from '../schema';
import type { IdpAttributes } from '../../auth/jwtClaims';

/**
 * Returns the app_user id for the given identity (provider code + subject), or null if not found.
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

/** A user's platform admin row. */
export interface SobaAdminGrant {
  source: string;
  identityProviderCode: string | null;
}

/** What identifying a signed-in caller needs from the database. */
export interface SignInState {
  providerActive: boolean;
  /** Null when no user has the identity yet. */
  identityId: string | null;
  userId: string | null;
  /** The stored IdP attributes equal the token's. */
  attributesCurrent: boolean;
  admin: SobaAdminGrant | null;
}

/**
 * The identity provider, the identity and the user's platform admin row in one read. Null when the
 * provider is unknown.
 */
export async function findSignInState(
  providerCode: string,
  subject: string,
  idpAttributes: IdpAttributes,
): Promise<SignInState | null> {
  const attributesCurrent = sql<boolean>`${userIdentities.idpAttributes} is not distinct from ${JSON.stringify(idpAttributes)}::jsonb`;
  const rows = await db
    .select({
      providerActive: identityProviders.isActive,
      identityId: userIdentities.id,
      userId: userIdentities.userId,
      attributesCurrent,
      adminSource: sobaAdmins.source,
      adminIdentityProviderCode: sobaAdmins.identityProviderCode,
    })
    .from(identityProviders)
    .leftJoin(
      userIdentities,
      and(
        eq(userIdentities.identityProviderCode, identityProviders.code),
        eq(userIdentities.subject, subject),
      ),
    )
    .leftJoin(sobaAdmins, eq(sobaAdmins.userId, userIdentities.userId))
    .where(eq(identityProviders.code, providerCode.toLowerCase()))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    providerActive: row.providerActive,
    identityId: row.identityId,
    userId: row.userId,
    attributesCurrent: row.attributesCurrent,
    admin: row.adminSource
      ? { source: row.adminSource, identityProviderCode: row.adminIdentityProviderCode }
      : null,
  };
}
