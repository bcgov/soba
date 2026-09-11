import { index, integer, text, uuid } from 'drizzle-orm/pg-core';
import { auditColumns, idColumn } from './audit';
import { sobaSchema, workspaces } from './core';

/**
 * Stored-file metadata, one row per upload. The uuid id is the public reference; it maps to the
 * owning workspace and to the profile + backend ref where the bytes live. `submission_id` is an
 * optional tag (no FK) — uploads don't create submissions.
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
    submissionId: uuid('submission_id'),
    ...auditColumns(),
  },
  (table) => ({
    workspaceIdx: index('file_workspace_idx').on(table.workspaceId),
    submissionIdx: index('file_submission_idx').on(table.submissionId),
  }),
);
