import { and, count, eq, gte, sql, type SQL } from 'drizzle-orm';
import { db, type Tx } from '../../core/db/client';
import { JobType } from '../../core/db/codes';
import { insertJob } from '../../core/db/repos/jobRepo';
import { submitterEmailCopyRequests as requests } from '../../core/db/schema';
import type { EmailCopyJobParams } from '../../core/jobs/submitterEmailCopy';
import {
  EMAIL_COPY_SCOPES,
  exceededEmailCopyLimit,
  type EmailCopyHourlyLimits,
  type EmailCopyScope,
} from './limits';

// Held while counting and queuing, so requests at once count one after the other: a burst for one
// address cannot all count zero before any is saved.
const ADV_LOCK_SUBMITTER_EMAIL_COPY = 1_773_309_244;

export interface NewEmailCopy {
  workspaceId: string;
  formId: string;
  submissionId: string;
  /** Trimmed and lower-cased. */
  address: string;
  requestedBy: string;
  idpCode: string | null;
  maxAttempts: number;
}

export type EmailCopyRequest = typeof requests.$inferSelect;

/**
 * The last hour's requests that count against one scope for this copy. Every request counts,
 * whatever became of it; copies have a budget of their own.
 */
export const recentEmailCopies = (scope: EmailCopyScope, copy: NewEmailCopy): SQL | undefined => {
  const lastHour = gte(requests.createdAt, sql`now() - interval '1 hour'`);
  switch (scope) {
    case 'submission':
      return and(lastHour, eq(requests.submissionId, copy.submissionId));
    case 'recipient':
      return and(lastHour, eq(requests.address, copy.address));
    case 'form':
      return and(lastHour, eq(requests.formId, copy.formId));
    case 'workspace':
      return and(lastHour, eq(requests.workspaceId, copy.workspaceId));
    case 'environment':
      return lastHour;
  }
};

const countRecentEmailCopies = async (
  tx: Tx,
  scope: EmailCopyScope,
  copy: NewEmailCopy,
): Promise<number> => {
  const [row] = await tx
    .select({ total: count() })
    .from(requests)
    .where(recentEmailCopies(scope, copy));
  return row?.total ?? 0;
};

/**
 * Records the request and queues its job, in one transaction, unless one more would pass an hourly
 * limit, which it names. The request is what the job sends, so a copy needs no event of its own.
 */
export const queueEmailCopy = (
  copy: NewEmailCopy,
  limits: EmailCopyHourlyLimits,
): Promise<{ jobId: string } | { limit: EmailCopyScope }> =>
  db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ADV_LOCK_SUBMITTER_EMAIL_COPY})`);

    const totals = await Promise.all(
      EMAIL_COPY_SCOPES.map((scope) => countRecentEmailCopies(tx, scope, copy)),
    );
    const counts = Object.fromEntries(
      EMAIL_COPY_SCOPES.map((scope, index) => [scope, totals[index]]),
    ) as Record<EmailCopyScope, number>;
    const limit = exceededEmailCopyLimit(counts, limits);
    if (limit) return { limit };

    const [request] = await tx
      .insert(requests)
      .values({
        workspaceId: copy.workspaceId,
        formId: copy.formId,
        submissionId: copy.submissionId,
        address: copy.address,
        requestedBy: copy.requestedBy,
        idpCode: copy.idpCode,
      })
      .returning({ id: requests.id });
    const params: EmailCopyJobParams = { requestId: request.id };
    const jobId = await insertJob(tx, {
      type: JobType.submission_email_copy,
      workspaceId: copy.workspaceId,
      formId: copy.formId,
      submissionId: copy.submissionId,
      createdBy: copy.requestedBy,
      params,
      dedupeKey: `${JobType.submission_email_copy}:${request.id}`,
      maxAttempts: copy.maxAttempts,
    });
    if (!jobId) throw new Error('Email copy job not queued');
    return { jobId };
  });

/** The request a job sends, when it is still the job's own. */
export const findEmailCopyRequest = async (
  requestId: string,
  submissionId: string,
): Promise<EmailCopyRequest | null> => {
  const [row] = await db
    .select()
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.submissionId, submissionId)))
    .limit(1);
  return row ?? null;
};
