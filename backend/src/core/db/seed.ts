// Must be first: initializes .env + .env.local for this process.
import { env } from '../config/env';
env.loadEnv();

import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db, pool } from './client';
import {
  assertFormEngineInvariants,
  listPlatformFormEngines,
  setDefaultFormEngineByCode,
  upsertPlatformFormEngineByCode,
} from './repos/platformFormEngineRepo';
import {
  appUsers,
  enterpriseWorkspaceBindings,
  identityProviders,
  userIdentities,
  workspaces,
  workspaceMemberships,
} from './schema';
import { getFormEnginePlugins } from '../integrations/form-engine/FormEngineRegistry';

const SYSTEM_PROVIDER_CODE = 'system';
const SYSTEM_SUBJECT = 'soba-system';

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

  const systemProvider = await ensureIdentityProvider(SYSTEM_PROVIDER_CODE, 'SOBA Internal System');

  const existingSystemIdentity = await db.query.userIdentities.findFirst({
    where: and(
      eq(userIdentities.identityProviderId, systemProvider.id),
      eq(userIdentities.subject, SYSTEM_SUBJECT),
    ),
  });

  let systemUserId = existingSystemIdentity?.userId;
  if (!systemUserId) {
    systemUserId = uuidv7();
    await db.insert(appUsers).values({
      id: systemUserId,
      displayName: 'SOBA System',
      email: 'soba-system@local',
      status: 'active',
      createdBy: null,
      updatedBy: null,
    });
    await db.insert(userIdentities).values({
      id: uuidv7(),
      userId: systemUserId,
      identityProviderId: systemProvider.id,
      subject: SYSTEM_SUBJECT,
      externalUserId: 'soba-system',
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });
  }

  const providerSeeds = [
    { code: 'idir', name: 'IDIR' },
    { code: 'bceidbasic', name: 'BCEID Basic' },
    { code: 'bceidbusiness', name: 'BCEID Business' },
  ];
  for (const provider of providerSeeds) {
    await ensureIdentityProvider(provider.code, provider.name, systemUserId);
  }

  const discoveredEnginePlugins = getFormEnginePlugins();
  if (discoveredEnginePlugins.length === 0) {
    throw new Error('No form engine plugins installed. At least one engine plugin is required.');
  }

  for (const plugin of discoveredEnginePlugins) {
    await upsertPlatformFormEngineByCode({
      code: plugin.code,
      name: plugin.name,
      engineVersion: plugin.version,
      isActive: true,
      isDefault: false,
      actorId: systemUserId,
    });
  }

  const defaultCode =
    env.getOptionalEnv('FORM_ENGINE_DEFAULT_CODE') ??
    (discoveredEnginePlugins.some((plugin) => plugin.code === 'formio-v5')
      ? 'formio-v5'
      : discoveredEnginePlugins[0].code);
  await setDefaultFormEngineByCode(defaultCode, systemUserId);
  await assertFormEngineInvariants();

  const registeredEngines = await listPlatformFormEngines();
  console.log(
    `[seed] form engines: ${registeredEngines
      .map(
        (engine) =>
          `${engine.code}(active=${engine.isActive},default=${engine.isDefault},version=${
            engine.engineVersion ?? 'unknown'
          })`,
      )
      .join(', ')}`,
  );

  // Seed a baseline enterprise workspace binding so the CSTAR resolver has initial data.
  const demoWorkspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, 'demo-enterprise'),
  });
  let demoWorkspaceId = demoWorkspace?.id;
  if (!demoWorkspaceId) {
    demoWorkspaceId = uuidv7();
    await db.insert(workspaces).values({
      id: demoWorkspaceId,
      kind: 'enterprise',
      name: 'Demo Enterprise Workspace',
      slug: 'demo-enterprise',
      status: 'active',
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });
  }

  const ownerMembership = await db.query.workspaceMemberships.findFirst({
    where: and(
      eq(workspaceMemberships.workspaceId, demoWorkspaceId),
      eq(workspaceMemberships.userId, systemUserId),
    ),
  });
  if (!ownerMembership) {
    await db.insert(workspaceMemberships).values({
      id: uuidv7(),
      workspaceId: demoWorkspaceId,
      userId: systemUserId,
      role: 'owner',
      status: 'active',
      source: 'seed',
      acceptedAt: new Date(),
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });
  }

  const existingBinding = await db.query.enterpriseWorkspaceBindings.findFirst({
    where: and(
      eq(enterpriseWorkspaceBindings.providerCode, 'cstar'),
      eq(enterpriseWorkspaceBindings.externalWorkspaceId, 'demo-cstar-workspace'),
    ),
  });
  if (!existingBinding) {
    await db.insert(enterpriseWorkspaceBindings).values({
      id: uuidv7(),
      workspaceId: demoWorkspaceId,
      providerCode: 'cstar',
      externalWorkspaceId: 'demo-cstar-workspace',
      status: 'active',
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });
  }

  console.log(`Seed complete. SYSTEM_SOBA_USER_ID=${systemUserId}`);
  await pool.end();
};

seed().catch(async (error) => {
  console.error('Seed failed', error);
  await pool.end();
  process.exit(1);
});
