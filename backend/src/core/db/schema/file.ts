import { index, integer, text, uuid } from 'drizzle-orm/pg-core';
import { auditColumns, idColumn } from './audit';
import { sobaSchema, workspaces } from './core';
import { forms } from './forms';

/**
 * Stored-file metadata, one row per upload. The uuid id is the public reference; it maps to the
 * owning workspace and to the profile + backend ref where the bytes live. Form and submission
 * associations are optional because an upload can exist before a feature claims it.
 */
export const files = sobaSchema.table(
  'file',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    profile: text('profile').notNull(),
    backendRef: text('backend_ref').notNull(),
    filename: text('filename').notNull(),
    contentType: text('content_type'),
    size: integer('size'),
    formId: uuid('form_id').references(() => forms.id),
    submissionId: uuid('submission_id'),
    ...auditColumns(),
  },
  (table) => ({
    workspaceIdx: index('file_workspace_idx').on(table.workspaceId),
    formIdx: index('file_form_idx').on(table.formId),
    submissionIdx: index('file_submission_idx').on(table.submissionId),
  }),
);
