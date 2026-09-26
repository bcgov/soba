import { index, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { auditColumns, idColumn } from './audit';
import { sobaSchema, workspaces } from './core';
import { files } from './file';
import { formVersions, forms } from './forms';

/**
 * A document template on one form version: a stored file under a name unique within the version.
 * The id stays the same when the file is replaced.
 */
export const documentTemplates = sobaSchema.table(
  'document_template',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id),
    formVersionId: uuid('form_version_id')
      .notNull()
      .references(() => formVersions.id),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id),
    name: text('name').notNull(),
    ...auditColumns(),
  },
  (table) => ({
    fileUnique: uniqueIndex('document_template_file_uq').on(table.fileId),
    versionNameUnique: uniqueIndex('document_template_version_name_uq').on(
      table.formVersionId,
      table.name,
    ),
    workspaceIdx: index('document_template_workspace_idx').on(table.workspaceId),
  }),
);
