/**
 * Resolves the system SOBA user id from identity (provider=system, subject=SOBA_SYSTEM_SUBJECT).
 * Result is cached so we do not query the DB on every use.
 */
import { env } from '../config/env';
import { findUserIdByIdentity } from '../db/repos/membershipRepo';

const SYSTEM_PROVIDER_CODE = 'system';
const DEFAULT_SYSTEM_SUBJECT = 'soba-system';

let cachedSystemUserId: string | null | undefined = undefined;

export async function getSystemSobaUserId(): Promise<string | undefined> {
  if (cachedSystemUserId !== undefined) {
    return cachedSystemUserId ?? undefined;
  }
  const subject = env.getSystemSobaSubject() ?? DEFAULT_SYSTEM_SUBJECT;
  const id = await findUserIdByIdentity(SYSTEM_PROVIDER_CODE, subject);
  cachedSystemUserId = id;
  return id ?? undefined;
}
