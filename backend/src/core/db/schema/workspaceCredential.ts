import { check, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { idColumn } from './audit';
import { sobaSchema, workspaces } from './core';

export const credentialStatuses = ['issuing', 'active', 'rotating', 'unknown'] as const;
export type CredentialStatus = (typeof credentialStatuses)[number];

// API keys never enter this table. Pending/unknown rows deliberately retain the workspace slot.
export const workspaceCredentials = sobaSchema.table(
  'workspace_credential',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    issuerCode: text('issuer_code').notNull(),
    clientId: text('client_id'),
    flow: text('flow'),
    notes: text('notes').notNull().default(''),
    status: text('status').$type<CredentialStatus>().notNull(),
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
  },
  (table) => ({
    workspaceUnique: uniqueIndex('workspace_credential_workspace_uq').on(table.workspaceId),
    consumerUnique: uniqueIndex('workspace_credential_consumer_uq').on(
      table.issuerCode,
      table.clientId,
    ),
    statusCheck: check(
      'workspace_credential_status_check',
      sql`${table.status} in ('issuing', 'active', 'rotating', 'unknown')`,
    ),
  }),
);

export const credentialAudit = sobaSchema.table('credential_audit', {
  id: idColumn(),
  credentialId: uuid('credential_id')
    .notNull()
    .references(() => workspaceCredentials.id),
  actorId: uuid('actor_id').notNull(),
  action: text('action').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
