import { and, eq } from 'drizzle-orm';
import { POST_SUBMISSION_EMAIL_PACKAGE_CODE } from '@soba/lib';
import { quietDb, type DbOrTx } from '../client';
import type { SubmissionPackageAuditActionCode } from '../codes';
import { jobs, submissionPackageAudits } from '../schema';

/** The job, when it built a package of this submission in this workspace. */
export const packageJobOf = (workspaceId: string, submissionId: string, jobId: string) =>
  and(
    eq(jobs.id, jobId),
    eq(jobs.workspaceId, workspaceId),
    eq(jobs.submissionId, submissionId),
    eq(jobs.type, POST_SUBMISSION_EMAIL_PACKAGE_CODE),
  );

/** Whether the job built a package of this submission in this workspace. */
export const isPackageJobOf = async (
  workspaceId: string,
  submissionId: string,
  jobId: string,
): Promise<boolean> => {
  const [row] = await quietDb
    .select({ id: jobs.id })
    .from(jobs)
    .where(packageJobOf(workspaceId, submissionId, jobId));
  return row !== undefined;
};

export interface PackageAuditRow {
  workspaceId: string;
  formId: string;
  submissionId: string;
  jobId: string;
  fileId: string | null;
  action: SubmissionPackageAuditActionCode;
  size: number | null;
  actorId: string;
  requestId: string | null;
}

export const insertPackageAudit = async (dbOrTx: DbOrTx, row: PackageAuditRow): Promise<void> => {
  await dbOrTx.insert(submissionPackageAudits).values({
    workspaceId: row.workspaceId,
    formId: row.formId,
    submissionId: row.submissionId,
    jobId: row.jobId,
    fileId: row.fileId,
    action: row.action,
    size: row.size,
    requestId: row.requestId,
    createdBy: row.actorId,
  });
};
