import { boolean, index, integer, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { auditColumns, idColumn } from './audit';
import { sobaSchema, workspaces } from './core';
import { forms } from './forms';

/**
 * What a workspace's confirmation screen offers submitters, served by the form-settings
 * `confirmation` module. One row per workspace, created with it; each flag is a typed column whose
 * database default is the setting's default.
 */
export const workspaceConfirmationSettings = sobaSchema.table(
  'workspace_confirmation_setting',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    allowSubmitterEmailCopy: boolean('allow_submitter_email_copy').notNull().default(true),
    /** Moves on with every save; a save names the version it started from. */
    version: integer('version').notNull().default(1),
    ...auditColumns(),
  },
  (table) => ({
    workspaceUnique: uniqueIndex('workspace_confirmation_setting_workspace_uq').on(
      table.workspaceId,
    ),
  }),
);

/**
 * A form's confirmation settings. One row per form, created with it. While `inherit` is true the
 * form uses the workspace's settings and its own flags are null; otherwise they hold the form's
 * settings.
 */
export const formConfirmationSettings = sobaSchema.table(
  'form_confirmation_setting',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id),
    inherit: boolean('inherit').notNull().default(true),
    allowSubmitterEmailCopy: boolean('allow_submitter_email_copy'),
    /** Moves on with every save; a save names the version it started from. */
    version: integer('version').notNull().default(1),
    ...auditColumns(),
  },
  (table) => ({
    formUnique: uniqueIndex('form_confirmation_setting_form_uq').on(table.formId),
    workspaceIdx: index('form_confirmation_setting_workspace_idx').on(table.workspaceId),
  }),
);
