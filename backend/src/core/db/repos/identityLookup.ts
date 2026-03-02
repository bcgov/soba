import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { userIdentities } from '../schema';

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
