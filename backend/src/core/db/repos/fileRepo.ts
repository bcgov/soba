import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../client';
import { files } from '../schema';

export type FileRecord = typeof files.$inferSelect;

export interface NewFileRecord {
  workspaceId: string;
  profile: string;
  backendRef: string;
  filename: string;
  contentType?: string | null;
  size?: number | null;
  submissionId?: string | null;
  createdBy?: string | null;
}

export const createFileRecord = async (input: NewFileRecord): Promise<FileRecord> => {
  const [row] = await db
    .insert(files)
    .values({
      workspaceId: input.workspaceId,
      profile: input.profile,
      backendRef: input.backendRef,
      filename: input.filename,
      contentType: input.contentType ?? null,
      size: input.size ?? null,
      submissionId: input.submissionId ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return row;
};

export const getFileRecordById = async (id: string): Promise<FileRecord | null> => {
  const rows = await db.select().from(files).where(eq(files.id, id)).limit(1);
  return rows[0] ?? null;
};

export const deleteFileRecordById = async (id: string): Promise<void> => {
  await db.delete(files).where(eq(files.id, id));
};

/**
 * Tag files with their submission. Only touches files in the given workspace, and only when
 * unassigned or already on this submission (won't move files between submissions; idempotent).
 * Returns the number of rows updated.
 */
export const associateFilesWithSubmission = async (
  fileIds: string[],
  submissionId: string,
  workspaceId: string,
): Promise<number> => {
  if (fileIds.length === 0) return 0;
  const rows = await db
    .update(files)
    .set({ submissionId })
    .where(
      and(
        inArray(files.id, fileIds),
        eq(files.workspaceId, workspaceId),
        or(isNull(files.submissionId), eq(files.submissionId, submissionId)),
      ),
    )
    .returning({ id: files.id });
  return rows.length;
};
