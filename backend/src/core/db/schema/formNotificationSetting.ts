import { index, integer, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { auditColumns, idColumn } from './audit';
import { sobaSchema, workspaces } from './core';
import { forms } from './forms';

export const formNotificationSettings = sobaSchema.table(
  'form_notification_setting',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id),
    recipients: text('recipients')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    version: integer('version').notNull().default(1),
    ...auditColumns(),
  },
  (table) => ({
    formUnique: uniqueIndex('form_notification_setting_form_uq').on(table.formId),
    workspaceIdx: index('form_notification_setting_workspace_idx').on(table.workspaceId),
  }),
);
