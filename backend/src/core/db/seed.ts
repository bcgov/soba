// Must be first: initializes .env + .env.local for this process.
import { env } from '../config/env';
env.loadEnv();

import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db, pool } from './client';
import { appUsers, identityProviders, userIdentities } from './schema';

const SYSTEM_PROVIDER_CODE = 'system';
const DEFAULT_SYSTEM_SUBJECT = 'soba-system';

const ensureIdentityProvider = async (code: string, name: string, actorId?: string) => {
  const existing = await db.query.identityProviders.findFirst({
    where: eq(identityProviders.code, code),
  });
  if (existing) return existing;
  const inserted = await db
    .insert(identityProviders)
    .values({
      id: uuidv7(),
      code,
      name,
      isActive: true,
      createdBy: actorId ?? null,
      updatedBy: actorId ?? null,
    })
    .returning();
  return inserted[0];
};

const seed = async () => {
  await pool.query('CREATE SCHEMA IF NOT EXISTS soba;');

  const systemSubject = env.getSystemSobaSubject() ?? DEFAULT_SYSTEM_SUBJECT;
  const systemProvider = await ensureIdentityProvider(SYSTEM_PROVIDER_CODE, 'SOBA Internal System');

  const existingSystemIdentity = await db.query.userIdentities.findFirst({
    where: and(
      eq(userIdentities.identityProviderId, systemProvider.id),
      eq(userIdentities.subject, systemSubject),
    ),
  });

  let systemUserId = existingSystemIdentity?.userId;
  if (!systemUserId) {
    systemUserId = uuidv7();
    await db.insert(appUsers).values({
      id: systemUserId,
      displayLabel: 'SOBA System',
      profile: { displayName: 'SOBA System' },
      status: 'active',
      createdBy: null,
      updatedBy: null,
    });
    await db.insert(userIdentities).values({
      id: uuidv7(),
      userId: systemUserId,
      identityProviderId: systemProvider.id,
      subject: systemSubject,
      externalUserId: 'soba-system',
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });
  }

  console.log(`Seed complete. System user subject: ${systemSubject}`);
  await pool.end();
};

seed().catch(async (error) => {
  console.error('Seed failed', error);
  await pool.end();
  process.exit(1);
});
