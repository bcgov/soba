import { v7 as uuidv7 } from 'uuid';
import { index, jsonb, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';
import { appUsers, sobaSchema, workspaces } from './core';

const idColumn = () => uuid('id').primaryKey().$defaultFn(uuidv7);

export const integrationOutbox = sobaSchema.table(
  'integration_outbox',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    topic: text('topic').notNull(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => appUsers.id),
    updatedBy: uuid('updated_by').references(() => appUsers.id),
  },
  (table) => ({
    statusWorkspaceIdx: index('integration_outbox_status_workspace_idx').on(
      table.status,
      table.workspaceId,
    ),
    statusNextAttemptIdx: index('integration_outbox_status_next_attempt_idx').on(
      table.status,
      table.nextAttemptAt,
    ),
    aggregateIdx: index('integration_outbox_aggregate_idx').on(
      table.aggregateType,
      table.aggregateId,
    ),
  }),
);
