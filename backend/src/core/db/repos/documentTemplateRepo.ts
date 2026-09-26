import { and, asc, eq, isNull } from 'drizzle-orm';
import { db, type Tx } from '../client';
import { documentTemplates, files, formVersions, forms } from '../schema';
import type { FileRecord } from './fileRepo';

export type DocumentTemplateRecord = typeof documentTemplates.$inferSelect;

/** A template with the file it holds. */
export interface DocumentTemplateWithFile {
  template: DocumentTemplateRecord;
  file: FileRecord;
}

export interface NewDocumentTemplate {
  id: string;
  workspaceId: string;
  formId: string;
  formVersionId: string;
  fileId: string;
  name: string;
  createdBy: string;
}

const heldBy = (id: string, fileId: string) =>
  and(eq(documentTemplates.id, id), eq(documentTemplates.fileId, fileId));

export const insertDocumentTemplate = async (tx: Tx, input: NewDocumentTemplate): Promise<void> => {
  await tx.insert(documentTemplates).values(input);
};

/** Point the template at a new file; false when it no longer holds `fromFileId`. */
export const setDocumentTemplateFile = async (
  tx: Tx,
  id: string,
  fromFileId: string,
  toFileId: string,
  updatedBy: string,
): Promise<boolean> => {
  const rows = await tx
    .update(documentTemplates)
    .set({ fileId: toFileId, updatedBy, updatedAt: new Date() })
    .where(heldBy(id, fromFileId))
    .returning({ id: documentTemplates.id });
  return rows.length > 0;
};

export const renameDocumentTemplate = async (
  id: string,
  name: string,
  updatedBy: string,
): Promise<DocumentTemplateRecord | null> => {
  const [row] = await db
    .update(documentTemplates)
    .set({ name, updatedBy, updatedAt: new Date() })
    .where(eq(documentTemplates.id, id))
    .returning();
  return row ?? null;
};

/** Delete the template; false when it no longer holds `fileId`. */
export const deleteDocumentTemplate = async (
  tx: Tx,
  id: string,
  fileId: string,
): Promise<boolean> => {
  const rows = await tx
    .delete(documentTemplates)
    .where(heldBy(id, fileId))
    .returning({ id: documentTemplates.id });
  return rows.length > 0;
};

/**
 * Give `toFormVersionId` a template for each template on `fromFormVersionId`, with the same name
 * and pointing at the same file.
 */
export const copyDocumentTemplates = async (
  tx: Tx,
  fromFormVersionId: string,
  toFormVersionId: string,
  createdBy: string,
): Promise<void> => {
  // Locked so a concurrent replace or delete of a source template either waits for the copy or is
  // seen by it.
  const sources = await tx
    .select()
    .from(documentTemplates)
    .where(eq(documentTemplates.formVersionId, fromFormVersionId))
    .for('share');
  if (sources.length === 0) return;
  await tx.insert(documentTemplates).values(
    sources.map((source) => ({
      workspaceId: source.workspaceId,
      formId: source.formId,
      formVersionId: toFormVersionId,
      fileId: source.fileId,
      name: source.name,
      createdBy,
    })),
  );
};

/** Whether any template points at the file. */
export const hasDocumentTemplateForFile = async (tx: Tx, fileId: string): Promise<boolean> => {
  const rows = await tx
    .select({ id: documentTemplates.id })
    .from(documentTemplates)
    .where(eq(documentTemplates.fileId, fileId))
    .limit(1);
  return rows.length > 0;
};

const selectWithFile = () =>
  db
    .select({ template: documentTemplates, file: files })
    .from(documentTemplates)
    .innerJoin(files, eq(files.id, documentTemplates.fileId));

export const getDocumentTemplate = async (id: string): Promise<DocumentTemplateWithFile | null> => {
  const rows = await selectWithFile().where(eq(documentTemplates.id, id)).limit(1);
  return rows[0] ?? null;
};

export const listDocumentTemplates = async (
  formVersionId: string,
): Promise<DocumentTemplateWithFile[]> =>
  selectWithFile()
    .where(eq(documentTemplates.formVersionId, formVersionId))
    .orderBy(asc(documentTemplates.name));

/**
 * The workspace and form a template belongs to; null when there is no such template, or its form
 * or form version is deleted.
 */
export const getDocumentTemplateScope = async (
  id: string,
): Promise<{ workspaceId: string; formId: string } | null> => {
  const rows = await db
    .select({ workspaceId: documentTemplates.workspaceId, formId: documentTemplates.formId })
    .from(documentTemplates)
    .innerJoin(formVersions, eq(formVersions.id, documentTemplates.formVersionId))
    .innerJoin(forms, eq(forms.id, documentTemplates.formId))
    .where(
      and(eq(documentTemplates.id, id), isNull(formVersions.deletedAt), isNull(forms.deletedAt)),
    )
    .limit(1);
  return rows[0] ?? null;
};
