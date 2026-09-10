import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import {
  documentGenerationFormConfigurations,
  documentGenerationTemplates,
  files,
} from '../schema';

export type DocumentGenerationTemplateRecord = typeof documentGenerationTemplates.$inferSelect;
export type DocumentGenerationConfigurationRecord =
  typeof documentGenerationFormConfigurations.$inferSelect;

export type DocumentGenerationTemplateWithFile = DocumentGenerationTemplateRecord & {
  file: typeof files.$inferSelect;
};

export async function createDocumentGenerationTemplate(input: {
  formId: string;
  fileId: string;
  actorId: string;
}): Promise<DocumentGenerationTemplateRecord> {
  const [record] = await db
    .insert(documentGenerationTemplates)
    .values({
      formId: input.formId,
      fileId: input.fileId,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    })
    .returning();
  return record;
}

export async function listDocumentGenerationTemplates(
  formId: string,
): Promise<DocumentGenerationTemplateWithFile[]> {
  const rows = await db
    .select({ template: documentGenerationTemplates, file: files })
    .from(documentGenerationTemplates)
    .innerJoin(files, eq(files.id, documentGenerationTemplates.fileId))
    .where(eq(documentGenerationTemplates.formId, formId))
    .orderBy(documentGenerationTemplates.createdAt);
  return rows.map(({ template, file }) => ({ ...template, file }));
}

export async function getDocumentGenerationTemplate(
  formId: string,
  templateId: string,
): Promise<DocumentGenerationTemplateWithFile | null> {
  const rows = await db
    .select({ template: documentGenerationTemplates, file: files })
    .from(documentGenerationTemplates)
    .innerJoin(files, eq(files.id, documentGenerationTemplates.fileId))
    .where(
      and(
        eq(documentGenerationTemplates.id, templateId),
        eq(documentGenerationTemplates.formId, formId),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? { ...row.template, file: row.file } : null;
}

export async function getDocumentGenerationConfiguration(
  formId: string,
): Promise<DocumentGenerationConfigurationRecord | null> {
  const rows = await db
    .select()
    .from(documentGenerationFormConfigurations)
    .where(eq(documentGenerationFormConfigurations.formId, formId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertDocumentGenerationConfiguration(input: {
  formId: string;
  printableName: string | null;
  defaultTemplateId: string | null;
  actorId: string;
}): Promise<DocumentGenerationConfigurationRecord> {
  const [record] = await db
    .insert(documentGenerationFormConfigurations)
    .values({
      formId: input.formId,
      printableName: input.printableName,
      defaultTemplateId: input.defaultTemplateId,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    })
    .onConflictDoUpdate({
      target: documentGenerationFormConfigurations.formId,
      set: {
        printableName: input.printableName,
        defaultTemplateId: input.defaultTemplateId,
        updatedBy: input.actorId,
        updatedAt: new Date(),
      },
    })
    .returning();
  return record;
}
