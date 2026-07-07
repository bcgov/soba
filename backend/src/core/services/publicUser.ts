/**
 * Resolves the public SOBA user (provider=public, subject=soba-public), used to attribute anonymous
 * requests on public-audience form routes. Result is cached so we do not query the DB on every use.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { appUsers } from '../db/schema';
import { findUserIdByIdentity } from '../db/repos/identityLookup';
import { PUBLIC_PROVIDER_CODE, PUBLIC_SUBJECT } from '../db/codes';

export interface PublicUser {
  id: string;
  displayLabel: string | null;
}

let cached: PublicUser | null | undefined = undefined;

async function load(): Promise<PublicUser | null> {
  const id = await findUserIdByIdentity(PUBLIC_PROVIDER_CODE, PUBLIC_SUBJECT);
  if (!id) return null;
  const row = await db
    .select({ displayLabel: appUsers.displayLabel })
    .from(appUsers)
    .where(eq(appUsers.id, id))
    .limit(1);
  return { id, displayLabel: row[0]?.displayLabel ?? null };
}

/** Returns the cached public user (id + displayLabel). Resolves once, then cached. */
export async function getPublicUser(): Promise<PublicUser | undefined> {
  if (cached !== undefined) {
    return cached ?? undefined;
  }
  cached = await load();
  return cached ?? undefined;
}
