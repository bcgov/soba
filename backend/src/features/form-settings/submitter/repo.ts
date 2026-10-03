import { and, eq } from 'drizzle-orm';
import { db, type DbOrTx } from '../../../core/db/client';
import { formSubmitterSettings } from '../../../core/db/schema';

export type SubmitterSettingsRecord = typeof formSubmitterSettings.$inferSelect;

/** Creates a new form's submitter settings, every flag at its database default. */
export const createSubmitterSettings = async (
  input: { workspaceId: string; formId: string; actorDisplayLabel: string | null },
  executor: DbOrTx,
): Promise<void> => {
  await executor.insert(formSubmitterSettings).values({
    workspaceId: input.workspaceId,
    formId: input.formId,
    createdBy: input.actorDisplayLabel,
    updatedBy: input.actorDisplayLabel,
  });
};

/** A form's submitter settings, or null when this form has no row in this workspace. */
export const findSubmitterSettings = async (
  workspaceId: string,
  formId: string,
): Promise<SubmitterSettingsRecord | null> => {
  const rows = await db
    .select()
    .from(formSubmitterSettings)
    .where(
      and(
        eq(formSubmitterSettings.workspaceId, workspaceId),
        eq(formSubmitterSettings.formId, formId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
};

/** Writes a form's submitter settings; null when this form has no row in this workspace. */
export const updateSubmitterSettings = async (input: {
  workspaceId: string;
  formId: string;
  allowSubmitterDrafts: boolean;
  actorDisplayLabel: string | null;
}): Promise<SubmitterSettingsRecord | null> => {
  const rows = await db
    .update(formSubmitterSettings)
    .set({
      allowSubmitterDrafts: input.allowSubmitterDrafts,
      updatedBy: input.actorDisplayLabel,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(formSubmitterSettings.workspaceId, input.workspaceId),
        eq(formSubmitterSettings.formId, input.formId),
      ),
    )
    .returning();
  return rows[0] ?? null;
};
