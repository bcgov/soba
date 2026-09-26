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
