import { v7 as uuidv7 } from 'uuid';
import { index, jsonb, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { appUsers, sobaSchema, workspaceGroups, workspaceMemberships, workspaces } from './core';

const idColumn = () => uuid('id').primaryKey().$defaultFn(uuidv7);

const auditColumns = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => appUsers.id),
  updatedBy: uuid('updated_by').references(() => appUsers.id),
});

export const enterpriseWorkspaceBindings = sobaSchema.table(
  'enterprise_workspace_binding',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    providerCode: text('provider_code').notNull(),
    externalWorkspaceId: text('external_workspace_id').notNull(),
    status: text('status').notNull(),
    config: jsonb('config'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    ...auditColumns(),
  },
  (table) => ({
    providerExternalUnique: uniqueIndex('enterprise_workspace_binding_provider_external_uq').on(
      table.providerCode,
      table.externalWorkspaceId,
    ),
    workspaceProviderUnique: uniqueIndex('enterprise_workspace_binding_workspace_provider_uq').on(
      table.workspaceId,
      table.providerCode,
    ),
  }),
);

export const enterpriseMembershipBindings = sobaSchema.table(
  'enterprise_membership_binding',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    workspaceMembershipId: uuid('workspace_membership_id')
      .notNull()
      .references(() => workspaceMemberships.id),
    providerCode: text('provider_code').notNull(),
    externalMembershipId: text('external_membership_id').notNull(),
    externalRole: text('external_role'),
    providerIdentityType: text('provider_identity_type'),
    providerIdentitySubject: text('provider_identity_subject'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    ...auditColumns(),
  },
  (table) => ({
    providerMembershipUnique: uniqueIndex(
      'enterprise_membership_binding_provider_membership_uq',
    ).on(table.providerCode, table.externalMembershipId),
    workspaceMembershipUnique: uniqueIndex(
      'enterprise_membership_binding_workspace_membership_uq',
    ).on(table.workspaceMembershipId),
    workspaceIdentityUnique: uniqueIndex('enterprise_membership_binding_workspace_identity_uq').on(
      table.workspaceId,
      table.providerIdentityType,
      table.providerIdentitySubject,
    ),
  }),
);

export const enterpriseGroupBindings = sobaSchema.table(
  'enterprise_group_binding',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    workspaceGroupId: uuid('workspace_group_id')
      .notNull()
      .references(() => workspaceGroups.id),
    providerCode: text('provider_code').notNull(),
    externalGroupId: text('external_group_id').notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    ...auditColumns(),
  },
  (table) => ({
    providerGroupUnique: uniqueIndex('enterprise_group_binding_provider_group_uq').on(
      table.providerCode,
      table.externalGroupId,
    ),
    workspaceGroupUnique: uniqueIndex('enterprise_group_binding_workspace_group_uq').on(
      table.workspaceGroupId,
    ),
  }),
);

export const enterpriseSyncCursors = sobaSchema.table(
  'enterprise_sync_cursor',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    providerCode: text('provider_code').notNull(),
    cursorKey: text('cursor_key').notNull(),
    cursorValue: text('cursor_value'),
    ...auditColumns(),
  },
  (table) => ({
    workspaceCursorUnique: uniqueIndex('enterprise_sync_cursor_workspace_cursor_uq').on(
      table.workspaceId,
      table.providerCode,
      table.cursorKey,
    ),
  }),
);

export const enterpriseSyncLogs = sobaSchema.table(
  'enterprise_sync_log',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    providerCode: text('provider_code').notNull(),
    syncType: text('sync_type').notNull(),
    status: text('status').notNull(),
    message: text('message'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    ...auditColumns(),
  },
  (table) => ({
    workspaceStartedIdx: index('enterprise_sync_log_workspace_started_idx').on(
      table.workspaceId,
      table.startedAt,
    ),
  }),
);
