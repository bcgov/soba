import { v7 as uuidv7 } from 'uuid';
import { index, jsonb, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { appUsers, sobaSchema, workspaces } from './core';

const idColumn = () => uuid('id').primaryKey().$defaultFn(uuidv7);

const auditColumns = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
});

export const personalWorkspaceSettings = sobaSchema.table(
  'personal_workspace_settings',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    defaultLandingPath: text('default_landing_path'),
    preferences: jsonb('preferences'),
    ...auditColumns(),
  },
  (table) => ({
    workspaceUnique: uniqueIndex('personal_workspace_settings_workspace_uq').on(table.workspaceId),
  }),
);

export const personalInvites = sobaSchema.table(
  'personal_invite',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    inviteeEmail: text('invitee_email').notNull(),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => appUsers.id),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => appUsers.id),
    inviteTokenHash: text('invite_token_hash').notNull(),
    status: text('status').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    ...auditColumns(),
  },
  (table) => ({
    tokenUnique: uniqueIndex('personal_invite_token_uq').on(table.inviteTokenHash),
    workspaceInviteeStatusIdx: index('personal_invite_workspace_invitee_status_idx').on(
      table.workspaceId,
      table.inviteeEmail,
      table.status,
    ),
  }),
);

export const personalAudit = sobaSchema.table(
  'personal_audit',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => appUsers.id),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ...auditColumns(),
  },
  (table) => ({
    workspaceOccurredIdx: index('personal_audit_workspace_occurred_idx').on(
      table.workspaceId,
      table.occurredAt,
    ),
  }),
);
