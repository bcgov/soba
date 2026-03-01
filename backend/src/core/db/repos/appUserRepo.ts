import { sql } from 'drizzle-orm';
import { db } from '../client';
import { appUsers } from '../schema';

/**
 * Returns the app_user id for the given email, or null if not found.
 * Used to resolve the system user by SYSTEM_SOBA_USER_EMAIL.
 * Email is read from app_user.profile->>'email'.
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const row = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(sql`${appUsers.profile}->>'email' = ${email}`)
    .limit(1);
  return row[0]?.id ?? null;
}
