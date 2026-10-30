import { and, count, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DEFAULT_SORT_LOCALE, type JOB_SORT_FIELDS, type SortToken } from '@soba/lib';
import { db, quietDb } from '../client';
import { JobStatus } from '../codes';
import { appUsers, forms, jobs, workspaces } from '../schema';
import { readListPage } from '../listRead';
import { orderByForSort, type SortColumns } from '../listSort';

export type JobListSortField = (typeof JOB_SORT_FIELDS)[number];

const JOB_SORT_COLUMNS: SortColumns<JobListSortField> = {
  createdAt: { column: jobs.createdAt },
  finishedAt: { column: jobs.finishedAt, nullable: true },
};

export interface JobListFilters {
  status?: string;
  type?: string;
  workspaceId?: string;
  formId?: string;
  submissionId?: string;
  offset: number;
  limit: number;
  sort: SortToken<JobListSortField>;
}

const listColumns = {
  id: jobs.id,
  type: jobs.type,
  status: jobs.status,
  attempts: jobs.attempts,
  maxAttempts: jobs.maxAttempts,
  workspaceId: jobs.workspaceId,
  workspaceName: workspaces.name,
  formId: jobs.formId,
  formName: forms.name,
  submissionId: jobs.submissionId,
  createdAt: jobs.createdAt,
  runAfter: jobs.runAfter,
  finishedAt: jobs.finishedAt,
  cancelRequestedAt: jobs.cancelRequestedAt,
  requeueCount: jobs.requeueCount,
  lastError: jobs.lastError,
};

const summaryColumns = {
  id: jobs.id,
  type: jobs.type,
  status: jobs.status,
  createdAt: jobs.createdAt,
  finishedAt: jobs.finishedAt,
};

/** A job as the admin list reads it. */
export interface AdminJobListRow {
  id: string;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  workspaceId: string;
  workspaceName: string;
  formId: string | null;
  formName: string | null;
  submissionId: string | null;
  createdAt: Date;
  runAfter: Date;
  finishedAt: Date | null;
  cancelRequestedAt: Date | null;
  requeueCount: number;
  lastError: string | null;
}

/** A job as its detail page reads it. */
export interface AdminJobRow extends AdminJobListRow {
  revisionId: string | null;
  parentJobId: string | null;
  params: Record<string, unknown>;
  startedAt: Date | null;
  createdById: string;
  createdByLabel: string | null;
  lastRequeuedAt: Date | null;
  lastRequeuedById: string | null;
  lastRequeuedByLabel: string | null;
  childrenQueuedAt: Date | null;
}

/** A related job in brief. */
export interface AdminJobSummaryRow {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
  finishedAt: Date | null;
}

/** Jobs for the admin list, newest first unless sorted otherwise, with workspace and form names. */
export const listJobsForAdmin = async (
  filters: JobListFilters,
): Promise<{ items: AdminJobListRow[]; total: number }> => {
  const conditions: SQL[] = [];
  if (filters.status) conditions.push(eq(jobs.status, filters.status));
  if (filters.type) conditions.push(eq(jobs.type, filters.type));
  if (filters.workspaceId) conditions.push(eq(jobs.workspaceId, filters.workspaceId));
  if (filters.formId) conditions.push(eq(jobs.formId, filters.formId));
  if (filters.submissionId) conditions.push(eq(jobs.submissionId, filters.submissionId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return readListPage(async (tx) => {
    const items = await tx
      .select(listColumns)
      .from(jobs)
      .innerJoin(workspaces, eq(workspaces.id, jobs.workspaceId))
      .leftJoin(forms, eq(forms.id, jobs.formId))
      .where(where)
      .orderBy(...orderByForSort(JOB_SORT_COLUMNS, filters.sort, jobs.id, DEFAULT_SORT_LOCALE))
      .limit(filters.limit)
      .offset(filters.offset);
    const totals = await tx.select({ total: count() }).from(jobs).where(where);
    return { items, total: totals[0]?.total ?? 0 };
  });
};

const createdByUser = alias(appUsers, 'created_by_user');
const requeuedByUser = alias(appUsers, 'requeued_by_user');

/** One job with what its detail page shows; null when it is gone. */
export const getJobForAdmin = async (id: string): Promise<AdminJobRow | null> => {
  const [row] = await db
    .select({
      ...listColumns,
      revisionId: jobs.revisionId,
      parentJobId: jobs.parentJobId,
      params: jobs.params,
      startedAt: jobs.startedAt,
      createdById: jobs.createdBy,
      createdByLabel: createdByUser.displayLabel,
      lastRequeuedAt: jobs.lastRequeuedAt,
      lastRequeuedById: jobs.lastRequeuedBy,
      lastRequeuedByLabel: requeuedByUser.displayLabel,
      childrenQueuedAt: jobs.childrenQueuedAt,
    })
    .from(jobs)
    .innerJoin(workspaces, eq(workspaces.id, jobs.workspaceId))
    .leftJoin(forms, eq(forms.id, jobs.formId))
    .innerJoin(createdByUser, eq(createdByUser.id, jobs.createdBy))
    .leftJoin(requeuedByUser, eq(requeuedByUser.id, jobs.lastRequeuedBy))
    .where(eq(jobs.id, id));
  return row ?? null;
};

/** A job's parent or other related job in brief; null when it is gone. */
export const getJobSummary = async (id: string): Promise<AdminJobSummaryRow | null> => {
  const [row] = await db.select(summaryColumns).from(jobs).where(eq(jobs.id, id));
  return row ?? null;
};

/** The jobs a job queued, oldest first. */
export const listChildJobs = (parentJobId: string): Promise<AdminJobSummaryRow[]> =>
  db
    .select(summaryColumns)
    .from(jobs)
    .where(eq(jobs.parentJobId, parentJobId))
    .orderBy(jobs.createdAt, jobs.id);

/**
 * Run a dead or cancelled job again as the same row: queued now, attempts from zero, its cancel
 * cleared. Its last error stays until the next outcome. False when the job is neither dead nor
 * cancelled, such as after another administrator ran it again.
 */
export const requeueJob = async (id: string, actorId: string): Promise<boolean> => {
  const rows = await quietDb
    .update(jobs)
    .set({
      status: JobStatus.queued,
      attempts: 0,
      runAfter: sql`now()`,
      claimToken: null,
      leaseUntil: null,
      cancelRequestedAt: null,
      finishedAt: null,
      requeueCount: sql`${jobs.requeueCount} + 1`,
      lastRequeuedAt: sql`now()`,
      lastRequeuedBy: actorId,
    })
    .where(and(eq(jobs.id, id), inArray(jobs.status, [JobStatus.dead, JobStatus.cancelled])))
    .returning({ id: jobs.id });
  return rows.length > 0;
};
