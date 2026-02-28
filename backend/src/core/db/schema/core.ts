import { sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { boolean, index, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const sobaSchema = pgSchema('soba');

const idColumn = () => uuid('id').primaryKey().$defaultFn(uuidv7);

const auditColumns = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => appUsers.id),
  updatedBy: uuid('updated_by').references(() => appUsers.id),
});

export const identityProviders = sobaSchema.table(
  'identity_provider',
  {
    id: idColumn(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns(),
  },
  (table) => ({
    codeUnique: uniqueIndex('identity_provider_code_uq').on(table.code),
  }),
);

export const platformFormEngines = sobaSchema.table(
  'platform_form_engine',
  {
    id: idColumn(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    engineVersion: text('engine_version'),
    isActive: boolean('is_active').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    ...auditColumns(),
  },
  (table) => ({
    codeUnique: uniqueIndex('platform_form_engine_code_uq').on(table.code),
    singleDefaultUnique: uniqueIndex('platform_form_engine_single_default_uq')
      .on(table.isDefault)
      .where(sql`${table.isDefault} = true`),
  }),
);

export const appUsers = sobaSchema.table(
  'app_user',
  {
    id: idColumn(),
    displayName: text('display_name'),
    email: text('email'),
    status: text('status').notNull(),
    ...auditColumns(),
  },
  (table) => ({
    emailIdx: index('app_user_email_idx').on(table.email),
  }),
);

export const userIdentities = sobaSchema.table(
  'user_identity',
  {
    id: idColumn(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id),
    identityProviderId: uuid('identity_provider_id')
      .notNull()
      .references(() => identityProviders.id),
    subject: text('subject').notNull(),
    externalUserId: text('external_user_id'),
    ...auditColumns(),
  },
  (table) => ({
    providerSubjectUnique: uniqueIndex('user_identity_provider_subject_uq').on(
      table.identityProviderId,
      table.subject,
    ),
    userProviderUnique: uniqueIndex('user_identity_user_provider_uq').on(
      table.userId,
      table.identityProviderId,
    ),
    userIdx: index('user_identity_user_idx').on(table.userId),
  }),
);

export const workspaces = sobaSchema.table(
  'workspace',
  {
    id: idColumn(),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    slug: text('slug'),
    status: text('status').notNull(),
    ownerUserId: uuid('owner_user_id').references(() => appUsers.id),
    ...auditColumns(),
  },
  (table) => ({
    slugUnique: uniqueIndex('workspace_slug_uq').on(table.slug),
    ownerIdx: index('workspace_owner_idx').on(table.ownerUserId),
  }),
);

export const workspaceMemberships = sobaSchema.table(
  'workspace_membership',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id),
    role: text('role').notNull(),
    status: text('status').notNull(),
    source: text('source').notNull(),
    invitedByUserId: uuid('invited_by_user_id').references(() => appUsers.id),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    ...auditColumns(),
  },
  (table) => ({
    workspaceUserUnique: uniqueIndex('workspace_membership_workspace_user_uq').on(
      table.workspaceId,
      table.userId,
    ),
    workspaceIdx: index('workspace_membership_workspace_idx').on(table.workspaceId),
    userIdx: index('workspace_membership_user_idx').on(table.userId),
  }),
);

export const workspaceGroups = sobaSchema.table(
  'workspace_group',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    externalGroupId: text('external_group_id'),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    ...auditColumns(),
  },
  (table) => ({
    workspaceNameUnique: uniqueIndex('workspace_group_workspace_name_uq').on(
      table.workspaceId,
      table.name,
    ),
    workspaceExternalUnique: uniqueIndex('workspace_group_workspace_external_uq').on(
      table.workspaceId,
      table.externalGroupId,
    ),
    workspaceIdx: index('workspace_group_workspace_idx').on(table.workspaceId),
  }),
);

export const workspaceGroupMemberships = sobaSchema.table(
  'workspace_group_membership',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    workspaceMembershipId: uuid('workspace_membership_id')
      .notNull()
      .references(() => workspaceMemberships.id),
    groupId: uuid('group_id')
      .notNull()
      .references(() => workspaceGroups.id),
    status: text('status').notNull(),
    ...auditColumns(),
  },
  (table) => ({
    workspaceMembershipGroupUnique: uniqueIndex('workspace_group_membership_uq').on(
      table.workspaceId,
      table.workspaceMembershipId,
      table.groupId,
    ),
    workspaceIdx: index('workspace_group_membership_workspace_idx').on(table.workspaceId),
    membershipIdx: index('workspace_group_membership_membership_idx').on(
      table.workspaceMembershipId,
    ),
    groupIdx: index('workspace_group_membership_group_idx').on(table.groupId),
  }),
);
