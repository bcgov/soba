import { index, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { idColumn } from './audit';
import { sobaSchema, appUsers, workspaces } from './core';
import { forms, submissions } from './forms';

/**
 * One submitter's request for a copy of their confirmation, with the address they typed. The job
 * that sends it names the request, so the address stays out of job rows. The hourly limits count
 * these rows.
 */
export const submitterEmailCopyRequests = sobaSchema.table(
  'submitter_email_copy_request',
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
    /** Trimmed and lower-cased. */
    address: text('address').notNull(),
    /** The requester, the public user for an anonymous one; the job reads the submission as them. */
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => appUsers.id),
    /** The requester's login provider when they asked, so the job reads as they did. */
    idpCode: text('idp_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    createdIdx: index('submitter_email_copy_request_created_idx').on(table.createdAt),
    submissionIdx: index('submitter_email_copy_request_submission_idx').on(table.submissionId),
    addressCreatedIdx: index('submitter_email_copy_request_address_created_idx').on(
      table.address,
      table.createdAt,
    ),
  }),
);
