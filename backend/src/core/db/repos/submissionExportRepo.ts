import { and, desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { submissionExports } from '../schema';

export interface NewSubmissionExport {
  workspaceId: string;
  formId: string;
  exportedBy: string;
  toDate: Date;
}

/** Upper bound of the person's last export of the form, or null. */
export const getLastExportToDate = async (
  formId: string,
  exportedBy: string,
): Promise<Date | null> => {
  const [row] = await db
    .select({ toDate: submissionExports.toDate })
    .from(submissionExports)
    .where(and(eq(submissionExports.formId, formId), eq(submissionExports.exportedBy, exportedBy)))
    .orderBy(desc(submissionExports.createdAt))
    .limit(1);
  return row?.toDate ?? null;
};

export const recordSubmissionExport = async (input: NewSubmissionExport): Promise<void> => {
  await db.insert(submissionExports).values(input);
};
