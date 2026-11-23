import { index, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { idColumn } from './audit';
import { appUsers, sobaSchema, workspaces } from './core';
import { forms, submissions } from './forms';

/**
 * Append-only log of submission package downloads: one row each time a package is downloaded.
 * Never holds submission data.
 */
export const submissionPackageAudits = sobaSchema.table(
  'submission_package_audit',
  {
    id: idColumn(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id),
    // No foreign keys: jobs and their result files are deleted under retention.
    jobId: uuid('job_id').notNull(),
    fileId: uuid('file_id'),
    // downloaded.
    action: text('action').notNull(),
    size: integer('size'),
    // Correlation id (X-Request-Id) to pivot an audit row back to the request's app logs.
    requestId: text('request_id'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => appUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    formCreatedIdx: index('submission_package_audit_form_created_idx').on(
      table.formId,
      table.createdAt,
    ),
    workspaceIdx: index('submission_package_audit_workspace_idx').on(table.workspaceId),
    jobIdx: index('submission_package_audit_job_idx').on(table.jobId),
  }),
);
