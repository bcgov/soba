import {
  boolean,
  index,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { auditColumns, idColumn } from './audit';
import { sobaSchema } from './sobaSchema';
import { CODE_SOURCE_CORE } from './codes';
import { roles } from './roles';

export { sobaSchema };

export const identityProviders = sobaSchema.table('identity_provider', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  hint: text('hint').notNull().default('code'),
  isActive: boolean('is_active').notNull().default(true),
  ...auditColumns(),
});

/**
 * Logical grouping of identity providers (e.g. `bcgov` = idir + azureidir).
 * Reusable primitive; `source` = 'core' or a feature code (mirrors code tables).
 */
export const idpGroups = sobaSchema.table('idp_group', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  source: text('source').notNull().default(CODE_SOURCE_CORE),
  ...auditColumns(),
});

export const idpGroupMembers = sobaSchema.table(
  'idp_group_member',
  {
    groupCode: text('group_code')
      .notNull()
      .references(() => idpGroups.code),
    identityProviderCode: text('identity_provider_code')
      .notNull()
      .references(() => identityProviders.code),
  },
  (table) => [primaryKey({ columns: [table.groupCode, table.identityProviderCode] })],
);

export const appUsers = sobaSchema.table(
  'app_user',
  {
    id: idColumn(),
    /** Human-readable label for user stamps / audit (idir_username, bceid_username, email, or fallback). */
    displayLabel: text('display_label'),
    /** IdP-agnostic display attributes (from token or seed). Use profileHelpers for displayName, email, etc. */
    profile: jsonb('profile'),
    status: text('status').notNull(),
    ...auditColumns(),
  },
  () => ({
    // No indexes on profile; use profileHelpers for display. Query by profile->>'email' if needed.
  }),
);

export const userIdentities = sobaSchema.table(
  'user_identity',
  {
    id: idColumn(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id),
    identityProviderCode: text('identity_provider_code')
      .notNull()
      .references(() => identityProviders.code),
    subject: text('subject').notNull(),
    externalUserId: text('external_user_id'),
    idpAttributes: jsonb('idp_attributes'),
    ...auditColumns(),
  },
  (table) => ({
    providerSubjectUnique: uniqueIndex('user_identity_provider_subject_uq').on(
      table.identityProviderCode,
      table.subject,
    ),
    userProviderUnique: uniqueIndex('user_identity_user_provider_uq').on(
      table.userId,
      table.identityProviderCode,
    ),
    userIdx: index('user_identity_user_idx').on(table.userId),
  }),
);

/**
 * SOBA platform admins (super powers, cross-workspace tasks).
 * One row per user; source is either 'idp' (refreshed on login from IdP claims) or 'direct' (manually added).
 * IdP-sourced rows are refreshed on each login: if the IdP no longer reports admin, the row is removed.
 */
export const sobaAdmins = sobaSchema.table(
  'soba_admin',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => appUsers.id),
    /** 'idp' = granted from IdP on login (e.g. role: soba_admin); 'direct' = manually added. */
    source: text('source').notNull(),
    /** When source='idp', which IdP plugin granted admin (plugin code, e.g. bcgov-sso); used for refresh/revoke on login. Not an FK so plugin code is not required in identity_provider (token provider may be azureidir/idir etc.). */
    identityProviderCode: text('identity_provider_code'),
    /** When source='idp', last time we synced this row from IdP. */
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    ...auditColumns(),
  },
  (table) => ({
    idpIdx: index('soba_admin_identity_provider_idx').on(table.identityProviderCode),
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
    parentWorkspaceId: uuid('parent_workspace_id').references(() => workspaces.id),
    ...auditColumns(),
  },
  (table) => ({
    slugUnique: uniqueIndex('workspace_slug_uq').on(table.slug),
    parentIdx: index('workspace_parent_idx').on(table.parentWorkspaceId),
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
    roleCode: text('role_code').references(() => roles.code),
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
