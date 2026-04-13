// Must be first: initializes .env + .env.local for this process.
import { env } from '../config/env';
env.loadEnv();

import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import {
  FeatureStatus,
  FormStatus,
  FormVersionState,
  OutboxStatus,
  RoleStatus,
  Roles,
  WorkspaceMembershipRole,
  WorkspaceMembershipStatus,
} from './codes';
import { db, pool } from './client';
import {
  appUsers,
  featureStatus,
  features,
  formStatus,
  formVersionState,
  identityProviders,
  outboxStatus,
  roleStatus,
  roles,
  userIdentities,
  workspaceMembershipRole,
  workspaceMembershipStatus,
} from './schema';
import { CODE_SOURCE_CORE } from './schema/codes';

const SYSTEM_PROVIDER_CODE = 'system';
const DEFAULT_SYSTEM_SUBJECT = 'soba-system';
const SYSTEM_DISPLAY_LABEL = 'SOBA System';
const SEED_USER_STAMP = 'SOBA System (seed)';

/** Audit stamp (`createdByLabel` / `updatedBy`) is last. */
const ensureIdentityProvider = async (
  code: string,
  name: string,
  isActive: boolean = true,
  createdByLabel?: string,
) => {
  const existing = await db.query.identityProviders.findFirst({
    where: eq(identityProviders.code, code),
  });
  if (existing) {
    if (existing.name !== name || existing.isActive !== isActive) {
      await db
        .update(identityProviders)
        .set({
          name,
          isActive,
          updatedBy: createdByLabel ?? null,
          updatedAt: new Date(),
        })
        .where(eq(identityProviders.code, code));
      return (await db.query.identityProviders.findFirst({
        where: eq(identityProviders.code, code),
      }))!;
    }
    return existing;
  }
  const inserted = await db
    .insert(identityProviders)
    .values({
      code,
      name,
      isActive,
      createdBy: createdByLabel ?? null,
      updatedBy: createdByLabel ?? null,
    })
    .returning();
  return inserted[0];
};

/** Codes match BC Gov Keycloak `identity_provider` (lowercased in app). See idp-bcgov-sso plugin. */
const SEED_BC_GOV_IDENTITY_PROVIDERS = [
  { code: 'idir', name: 'IDIR', isActive: false },
  { code: 'azureidir', name: 'Azure IDIR', isActive: true },
  { code: 'bceidbasic', name: 'BCeID Basic', isActive: false },
  { code: 'bceidbusiness', name: 'BCeID Business', isActive: false },
  { code: 'bcservicescard', name: 'BC Services Card', isActive: false },
  { code: 'bcsc', name: 'BC Services Card', isActive: false },
] as const;

const seedBcgovSsoIdentityProviders = async (createdByLabel: string) => {
  for (const { code, name, isActive } of SEED_BC_GOV_IDENTITY_PROVIDERS) {
    await ensureIdentityProvider(code, name, isActive, createdByLabel);
  }
};

const seedFeatureStatus = async () => {
  const rows = [
    {
      code: FeatureStatus.enabled,
      source: CODE_SOURCE_CORE,
      display: 'Enabled',
      sortOrder: 0,
      isActive: true,
    },
    {
      code: FeatureStatus.disabled,
      source: CODE_SOURCE_CORE,
      display: 'Disabled',
      sortOrder: 1,
      isActive: true,
    },
    {
      code: FeatureStatus.experimental,
      source: CODE_SOURCE_CORE,
      display: 'Experimental',
      sortOrder: 2,
      isActive: true,
    },
    {
      code: FeatureStatus.deprecated,
      source: CODE_SOURCE_CORE,
      display: 'Deprecated',
      sortOrder: 3,
      isActive: true,
    },
  ];
  for (const row of rows) {
    await db.insert(featureStatus).values(row).onConflictDoNothing();
  }
};

const seedCodeTables = async () => {
  const formStatusRows = [
    {
      code: FormStatus.active,
      source: CODE_SOURCE_CORE,
      display: 'Active',
      sortOrder: 0,
      isActive: true,
    },
    {
      code: FormStatus.archived,
      source: CODE_SOURCE_CORE,
      display: 'Archived',
      sortOrder: 1,
      isActive: true,
    },
    {
      code: FormStatus.deleted,
      source: CODE_SOURCE_CORE,
      display: 'Deleted',
      sortOrder: 2,
      isActive: true,
    },
  ];
  for (const row of formStatusRows) {
    await db.insert(formStatus).values(row).onConflictDoNothing();
  }
  const formVersionStateRows = [
    {
      code: FormVersionState.draft,
      source: CODE_SOURCE_CORE,
      display: 'Draft',
      sortOrder: 0,
      isActive: true,
    },
    {
      code: FormVersionState.published,
      source: CODE_SOURCE_CORE,
      display: 'Published',
      sortOrder: 1,
      isActive: true,
    },
    {
      code: FormVersionState.deleted,
      source: CODE_SOURCE_CORE,
      display: 'Deleted',
      sortOrder: 2,
      isActive: true,
    },
  ];
  for (const row of formVersionStateRows) {
    await db.insert(formVersionState).values(row).onConflictDoNothing();
  }
  const workspaceMembershipRoleRows = [
    {
      code: WorkspaceMembershipRole.owner,
      source: CODE_SOURCE_CORE,
      display: 'Owner',
      sortOrder: 0,
      isActive: true,
    },
    {
      code: WorkspaceMembershipRole.admin,
      source: CODE_SOURCE_CORE,
      display: 'Admin',
      sortOrder: 1,
      isActive: true,
    },
    {
      code: WorkspaceMembershipRole.member,
      source: CODE_SOURCE_CORE,
      display: 'Member',
      sortOrder: 2,
      isActive: true,
    },
    {
      code: WorkspaceMembershipRole.viewer,
      source: CODE_SOURCE_CORE,
      display: 'Viewer',
      sortOrder: 3,
      isActive: true,
    },
  ];
  for (const row of workspaceMembershipRoleRows) {
    await db.insert(workspaceMembershipRole).values(row).onConflictDoNothing();
  }
  const workspaceMembershipStatusRows = [
    {
      code: WorkspaceMembershipStatus.active,
      source: CODE_SOURCE_CORE,
      display: 'Active',
      sortOrder: 0,
      isActive: true,
    },
    {
      code: WorkspaceMembershipStatus.inactive,
      source: CODE_SOURCE_CORE,
      display: 'Inactive',
      sortOrder: 1,
      isActive: true,
    },
    {
      code: WorkspaceMembershipStatus.pending,
      source: CODE_SOURCE_CORE,
      display: 'Pending',
      sortOrder: 2,
      isActive: true,
    },
  ];
  for (const row of workspaceMembershipStatusRows) {
    await db.insert(workspaceMembershipStatus).values(row).onConflictDoNothing();
  }
  const outboxStatusRows = [
    {
      code: OutboxStatus.pending,
      source: CODE_SOURCE_CORE,
      display: 'Pending',
      sortOrder: 0,
      isActive: true,
    },
    {
      code: OutboxStatus.processing,
      source: CODE_SOURCE_CORE,
      display: 'Processing',
      sortOrder: 1,
      isActive: true,
    },
    {
      code: OutboxStatus.done,
      source: CODE_SOURCE_CORE,
      display: 'Done',
      sortOrder: 2,
      isActive: true,
    },
  ];
  for (const row of outboxStatusRows) {
    await db.insert(outboxStatus).values(row).onConflictDoNothing();
  }
};

const seedFeatures = async () => {
  const coreFeatures = [
    {
      code: 'form-versions',
      name: 'Form versions',
      description: null,
      version: null,
      status: FeatureStatus.enabled,
    },
    {
      code: 'submissions',
      name: 'Submissions',
      description: null,
      version: null,
      status: FeatureStatus.enabled,
    },
    {
      code: 'meta',
      name: 'Meta',
      description: null,
      version: null,
      status: FeatureStatus.enabled,
    },
    {
      code: 'workspaces',
      name: 'Workspaces',
      description: 'Workspace shell and membership (shared by design and submit flows)',
      version: null,
      status: FeatureStatus.enabled,
    },
    {
      code: 'designer',
      name: 'Design mode',
      description: 'Form management and design surfaces',
      version: null,
      status: FeatureStatus.enabled,
    },
    {
      code: 'submit-mode',
      name: 'Submit mode',
      description: 'Submitter-facing surfaces',
      version: null,
      status: FeatureStatus.enabled,
    },
  ];
  for (const row of coreFeatures) {
    await db
      .insert(features)
      .values({ ...row, createdBy: SEED_USER_STAMP, updatedBy: SEED_USER_STAMP })
      .onConflictDoNothing();
  }
};

const seedRoleStatus = async () => {
  const rows = [
    { code: RoleStatus.active, display: 'Active', sortOrder: 0, isActive: true },
    { code: RoleStatus.deprecated, display: 'Deprecated', sortOrder: 1, isActive: true },
  ];
  for (const row of rows) {
    await db.insert(roleStatus).values(row).onConflictDoNothing();
  }
};

const seedRoles = async () => {
  const roleRows = [
    {
      code: Roles.workspace_owner,
      name: 'Workspace owner',
      description: null,
      status: RoleStatus.active,
      source: CODE_SOURCE_CORE,
      featureCode: null,
    },
    {
      code: Roles.form_owner,
      name: 'Form owner',
      description: null,
      status: RoleStatus.active,
      source: CODE_SOURCE_CORE,
      featureCode: null,
    },
  ];
  for (const row of roleRows) {
    await db
      .insert(roles)
      .values({ ...row, createdBy: SEED_USER_STAMP, updatedBy: SEED_USER_STAMP })
      .onConflictDoNothing();
  }
};

const seed = async () => {
  await pool.query('CREATE SCHEMA IF NOT EXISTS soba;');

  await seedFeatureStatus();
  await seedFeatures();
  await seedRoleStatus();
  await seedRoles();
  await seedCodeTables();

  await seedBcgovSsoIdentityProviders(SEED_USER_STAMP);

  const systemSubject = env.getSystemSobaSubject() ?? DEFAULT_SYSTEM_SUBJECT;
  const systemProvider = await ensureIdentityProvider(
    SYSTEM_PROVIDER_CODE,
    'SOBA Internal System',
    true,
    SEED_USER_STAMP,
  );

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
