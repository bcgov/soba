/**
 * Resolves the system SOBA user (provider=system, subject=SOBA_SYSTEM_SUBJECT).
 * Result is cached so we do not query the DB on every use.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { appUsers } from '../db/schema';
import { env } from '../config/env';
import { findUserIdByIdentity } from '../db/repos/identityLookup';

const SYSTEM_PROVIDER_CODE = 'system';
const DEFAULT_SYSTEM_SUBJECT = 'soba-system';

export interface SystemUser {
  id: string;
  displayLabel: string | null;
}

let cached: SystemUser | null | undefined = undefined;

async function load(): Promise<SystemUser | null> {
  const subject = env.getSystemSobaSubject() ?? DEFAULT_SYSTEM_SUBJECT;
  const id = await findUserIdByIdentity(SYSTEM_PROVIDER_CODE, subject);
  if (!id) return null;
  const row = await db
    .select({ displayLabel: appUsers.displayLabel })
    .from(appUsers)
    .where(eq(appUsers.id, id))
    .limit(1);
  return { id, displayLabel: row[0]?.displayLabel ?? null };
}

/**
 * Returns the cached system user (id + displayLabel). Resolves once, then cached.
 */
export async function getSystemUser(): Promise<SystemUser | undefined> {
  if (cached !== undefined) {
    return cached ?? undefined;
  }
  cached = await load();
  return cached ?? undefined;
}
