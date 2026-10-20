import { index, timestamp, uuid } from 'drizzle-orm/pg-core';
import { idColumn } from './audit';
import { sobaSchema, appUsers, workspaces } from './core';
import { forms } from './forms';

/** Who exported a form and up to when; drives "since my last export". */
export const submissionExports = sobaSchema.table(
  'submission_export',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id),
    exportedBy: uuid('exported_by')
      .notNull()
      .references(() => appUsers.id),
    toDate: timestamp('to_date', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    formExporterIdx: index('submission_export_form_exporter_idx').on(
      table.formId,
      table.exportedBy,
      table.createdAt,
    ),
  }),
);
