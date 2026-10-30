import {
  check,
  foreignKey,
  index,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { CredentialType } from '@soba/lib';
import { sql } from 'drizzle-orm';
import { idColumn } from './audit';
import { sobaSchema, workspaces } from './core';
import { forms } from './forms';

export const credentialStatuses = ['issuing', 'active', 'rotating', 'unknown'] as const;
export type CredentialStatus = (typeof credentialStatuses)[number];

// API keys never enter this table. Each row tracks one independent issuance operation.
export const workspaceCredentials = sobaSchema.table(
  'workspace_credential',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    formId: uuid('form_id'),
    issuerCode: text('issuer_code').notNull(),
    clientId: text('client_id'),
    flow: text('flow'),
    label: text('label').notNull(),
    notes: text('notes').notNull().default(''),
    status: text('status').$type<CredentialStatus>().notNull(),
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
  },
  (table) => ({
    workspaceIndex: index('workspace_credential_workspace_idx').on(table.workspaceId),
    consumerUnique: uniqueIndex('workspace_credential_consumer_uq').on(
      table.issuerCode,
      table.clientId,
    ),
    formIndex: index('workspace_credential_form_idx').on(table.formId),
    formWorkspace: foreignKey({
      name: 'workspace_credential_form_workspace_fk',
      columns: [table.workspaceId, table.formId],
      foreignColumns: [forms.workspaceId, forms.id],
    }),
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

/** Supported purposes shared by many credentials. */
export const credentialTypes = sobaSchema.table(
  'credential_type',
  {
    code: text('code').$type<CredentialType>().primaryKey(),
  },
  (table) => ({
    codeCheck: check('credential_type_code_check', sql`${table.code} in ('api', 'web-component')`),
  }),
);

/** A credential may have several types; a type may be assigned to many credentials. */
export const credentialTypeAssignments = sobaSchema.table(
  'credential_type_assignment',
  {
    credentialId: uuid('credential_id')
      .notNull()
      .references(() => workspaceCredentials.id),
    typeCode: text('type_code')
      .$type<CredentialType>()
      .notNull()
      .references(() => credentialTypes.code),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.credentialId, table.typeCode] }),
    typeIndex: index('credential_type_assignment_type_idx').on(table.typeCode),
  }),
);
