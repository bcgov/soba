import { eq } from 'drizzle-orm';
import { db, type Tx } from '../client';
import { files } from '../schema';

export type FileRecord = typeof files.$inferSelect;

/** Writes or removes the owning feature's link row, inside the file row's transaction. */
export type FileLinkWrite = (tx: Tx, record: FileRecord) => Promise<void>;

export interface NewFileRecord {
  workspaceId: string;
  profile: string;
  backendRef: string;
  filename: string;
  contentType?: string | null;
  size?: number | null;
  createdBy?: string | null;
}

/** Insert a file row and its owner's link in one transaction. */
export const createFileRecord = async (
  input: NewFileRecord,
  link: FileLinkWrite,
): Promise<FileRecord> =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .insert(files)
      .values({
        workspaceId: input.workspaceId,
        profile: input.profile,
        backendRef: input.backendRef,
        filename: input.filename,
        contentType: input.contentType ?? null,
        size: input.size ?? null,
        createdBy: input.createdBy ?? null,
      })
      .returning();
    await link(tx, row);
    return row;
  });

/** Whether any of the owning feature's links still point at the file. */
export type FileLinkCheck = (tx: Tx, record: FileRecord) => Promise<boolean>;

/** Delete the owner's link, then the file row, in one transaction. */
export const deleteFileRecord = async (
  record: FileRecord,
  unlink: FileLinkWrite,
): Promise<void> => {
  await db.transaction(async (tx) => {
    await unlink(tx, record);
    await tx.delete(files).where(eq(files.id, record.id));
  });
};

/**
 * Delete the owner's link, then the file row when no link remains, in one transaction. True when
 * the file row is deleted.
 */
export const releaseFileRecord = async (
  record: FileRecord,
  unlink: FileLinkWrite,
  isLinked: FileLinkCheck,
): Promise<boolean> =>
  db.transaction(async (tx) => {
    await unlink(tx, record);
    // Locked after the unlink, so concurrent releases of one file count its links one at a time.
    await tx.select({ id: files.id }).from(files).where(eq(files.id, record.id)).for('update');
    if (await isLinked(tx, record)) return false;
    await tx.delete(files).where(eq(files.id, record.id));
    return true;
  });
