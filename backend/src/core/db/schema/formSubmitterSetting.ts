import { boolean, index, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { auditColumns, idColumn } from './audit';
import { sobaSchema, workspaces } from './core';
import { forms } from './forms';

/**
 * What a form's submitters may do, served by the form-settings `submitter` module. At most one row
 * per form; each flag is a typed column whose database default is the setting's default.
 */
export const formSubmitterSettings = sobaSchema.table(
  'form_submitter_setting',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id),
    allowSubmitterDrafts: boolean('allow_submitter_drafts').notNull().default(false),
    ...auditColumns(),
  },
  (table) => ({
    formUnique: uniqueIndex('form_submitter_setting_form_uq').on(table.formId),
    workspaceIdx: index('form_submitter_setting_workspace_idx').on(table.workspaceId),
  }),
);
