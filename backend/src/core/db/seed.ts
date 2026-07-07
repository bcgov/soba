// Must be first: initializes .env + .env.local for this process.
import { env } from '../config/env';
env.loadEnv();

import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { WorkspaceMembershipStatus } from './codes';
import { db, pool } from './client';
import { appUsers, identityProviders, userIdentities } from './schema';

const SYSTEM_PROVIDER_CODE = 'system';
const SYSTEM_PROVIDER_NAME = 'SOBA Internal System';
const DEFAULT_SYSTEM_SUBJECT = 'soba-system';
const SYSTEM_DISPLAY_LABEL = 'SOBA System';
const SEED_USER_STAMP = 'SOBA System (seed)';

/**
 * Ensures the internal `system` identity provider exists. Required for the system
 * user identity. All other reference/code data is managed via migrations.
 */
const ensureSystemIdentityProvider = async () => {
  const existing = await db.query.identityProviders.findFirst({
    where: eq(identityProviders.code, SYSTEM_PROVIDER_CODE),
  });
  if (existing) {
    return existing;
  }
  const inserted = await db
    .insert(identityProviders)
    .values({
      code: SYSTEM_PROVIDER_CODE,
      name: SYSTEM_PROVIDER_NAME,
      hint: SYSTEM_PROVIDER_CODE,
      isActive: true,
      isLoginProvider: false,
      createdBy: SEED_USER_STAMP,
      updatedBy: SEED_USER_STAMP,
    })
    .returning();
  return inserted[0];
};

const seed = async () => {
  await pool.query('CREATE SCHEMA IF NOT EXISTS soba;');

  const systemSubject = env.getSystemSobaSubject() ?? DEFAULT_SYSTEM_SUBJECT;
  const systemProvider = await ensureSystemIdentityProvider();

  const existingSystemIdentity = await db.query.userIdentities.findFirst({
    where: and(
      eq(userIdentities.identityProviderCode, systemProvider.code),
      eq(userIdentities.subject, systemSubject),
    ),
  });

  let systemUserId = existingSystemIdentity?.userId;
  if (!systemUserId) {
    systemUserId = uuidv7();
    await db.insert(appUsers).values({
      id: systemUserId,
      displayLabel: SYSTEM_DISPLAY_LABEL,
      profile: { displayName: 'SOBA System' },
      status: WorkspaceMembershipStatus.active,
      createdBy: SEED_USER_STAMP,
      updatedBy: SEED_USER_STAMP,
    });
    await db.insert(userIdentities).values({
      id: uuidv7(),
      userId: systemUserId,
      identityProviderCode: systemProvider.code,
      subject: systemSubject,
      externalUserId: 'soba-system',
      createdBy: SEED_USER_STAMP,
      updatedBy: SEED_USER_STAMP,
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
