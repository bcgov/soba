import { v7 as uuidv7 } from 'uuid';
import { index, text, timestamp, uniqueIndex, uuid, integer } from 'drizzle-orm/pg-core';
import {
  appUsers,
  platformFormEngines,
  sobaSchema,
  workspaceGroups,
  workspaceMemberships,
  workspaces,
} from './core';

const idColumn = () => uuid('id').primaryKey().$defaultFn(uuidv7);

const strictAuditColumns = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => appUsers.id),
  updatedBy: uuid('updated_by')
    .notNull()
    .references(() => appUsers.id),
});

export const forms = sobaSchema.table(
  'form',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    formEngineId: uuid('form_engine_id')
      .notNull()
      .references(() => platformFormEngines.id),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    ...strictAuditColumns(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => appUsers.id),
  },
  (table) => ({
    workspaceSlugUnique: uniqueIndex('form_workspace_slug_uq').on(table.workspaceId, table.slug),
    workspaceIdx: index('form_workspace_idx').on(table.workspaceId),
  }),
);

export const formMemberAccess = sobaSchema.table(
  'form_member_access',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id),
    workspaceMembershipId: uuid('workspace_membership_id')
      .notNull()
      .references(() => workspaceMemberships.id),
    accessLevel: text('access_level').notNull(),
    ...strictAuditColumns(),
  },
  (table) => ({
    uniqueGrant: uniqueIndex('form_member_access_workspace_form_member_uq').on(
      table.workspaceId,
      table.formId,
      table.workspaceMembershipId,
    ),
    workspaceIdx: index('form_member_access_workspace_idx').on(table.workspaceId),
  }),
);

export const formGroupAccess = sobaSchema.table(
  'form_group_access',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id),
    groupId: uuid('group_id')
      .notNull()
      .references(() => workspaceGroups.id),
    accessLevel: text('access_level').notNull(),
    ...strictAuditColumns(),
  },
  (table) => ({
    uniqueGrant: uniqueIndex('form_group_access_workspace_form_group_uq').on(
      table.workspaceId,
      table.formId,
      table.groupId,
    ),
    workspaceIdx: index('form_group_access_workspace_idx').on(table.workspaceId),
  }),
);

export const formVersions = sobaSchema.table(
  'form_version',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id),
    versionNo: integer('version_no').notNull(),
    state: text('state').notNull(),
    engineSchemaRef: text('engine_schema_ref'),
    engineSyncStatus: text('engine_sync_status').notNull(),
    engineSyncError: text('engine_sync_error'),
    currentRevisionNo: integer('current_revision_no').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by').references(() => appUsers.id),
    ...strictAuditColumns(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => appUsers.id),
  },
  (table) => ({
    uniqueVersion: uniqueIndex('form_version_workspace_form_version_uq').on(
      table.workspaceId,
      table.formId,
      table.versionNo,
    ),
    workspaceIdx: index('form_version_workspace_idx').on(table.workspaceId),
    formIdx: index('form_version_form_idx').on(table.formId),
  }),
);

export const formVersionRevisions = sobaSchema.table(
  'form_version_revision',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    formVersionId: uuid('form_version_id')
      .notNull()
      .references(() => formVersions.id),
    revisionNo: integer('revision_no').notNull(),
    eventType: text('event_type').notNull(),
    beforeEngineSchemaRef: text('before_engine_schema_ref'),
    afterEngineSchemaRef: text('after_engine_schema_ref'),
    changedBy: uuid('changed_by')
      .notNull()
      .references(() => appUsers.id),
    changeNote: text('change_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueRevision: uniqueIndex('form_version_revision_workspace_form_version_revision_uq').on(
      table.workspaceId,
      table.formVersionId,
      table.revisionNo,
    ),
    workspaceIdx: index('form_version_revision_workspace_idx').on(table.workspaceId),
  }),
);

export const submissions = sobaSchema.table(
  'submission',
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
    submittedBy: uuid('submitted_by').references(() => appUsers.id),
    workflowState: text('workflow_state').notNull(),
    engineSubmissionRef: text('engine_submission_ref'),
    engineSyncStatus: text('engine_sync_status').notNull(),
    engineSyncError: text('engine_sync_error'),
    currentRevisionNo: integer('current_revision_no').notNull().default(0),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    ...strictAuditColumns(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => appUsers.id),
  },
  (table) => ({
    workspaceWorkflowIdx: index('submission_workspace_workflow_idx').on(
      table.workspaceId,
      table.workflowState,
    ),
    workspaceIdx: index('submission_workspace_idx').on(table.workspaceId),
    formVersionIdx: index('submission_form_version_idx').on(table.formVersionId),
  }),
);

export const submissionMemberAccess = sobaSchema.table(
  'submission_member_access',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id),
    workspaceMembershipId: uuid('workspace_membership_id')
      .notNull()
      .references(() => workspaceMemberships.id),
    accessLevel: text('access_level').notNull(),
    ...strictAuditColumns(),
  },
  (table) => ({
    uniqueGrant: uniqueIndex('submission_member_access_workspace_submission_member_uq').on(
      table.workspaceId,
      table.submissionId,
      table.workspaceMembershipId,
    ),
    workspaceIdx: index('submission_member_access_workspace_idx').on(table.workspaceId),
  }),
);

export const submissionGroupAccess = sobaSchema.table(
  'submission_group_access',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id),
    groupId: uuid('group_id')
      .notNull()
      .references(() => workspaceGroups.id),
    accessLevel: text('access_level').notNull(),
    ...strictAuditColumns(),
  },
  (table) => ({
    uniqueGrant: uniqueIndex('submission_group_access_workspace_submission_group_uq').on(
      table.workspaceId,
      table.submissionId,
      table.groupId,
    ),
    workspaceIdx: index('submission_group_access_workspace_idx').on(table.workspaceId),
  }),
);

export const submissionRevisions = sobaSchema.table(
  'submission_revision',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id),
    revisionNo: integer('revision_no').notNull(),
    eventType: text('event_type').notNull(),
    beforeEngineSubmissionRef: text('before_engine_submission_ref'),
    afterEngineSubmissionRef: text('after_engine_submission_ref'),
    changedBy: uuid('changed_by')
      .notNull()
      .references(() => appUsers.id),
    changeNote: text('change_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueRevision: uniqueIndex('submission_revision_workspace_submission_revision_uq').on(
      table.workspaceId,
      table.submissionId,
      table.revisionNo,
    ),
    workspaceIdx: index('submission_revision_workspace_idx').on(table.workspaceId),
  }),
);
