import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../../core/db/client';
import { formSubmitterSettings, forms } from '../../../core/db/schema';
import { SETTINGS_AUTO_ACTOR } from '../constants';

export type SubmitterSettingsRecord = typeof formSubmitterSettings.$inferSelect;

/**
 * Inserts a live form's submitter settings when it has none, with every flag at its database
 * default. Reached only when a form has no row, which is a form created after the backfill
 * migration. The form is checked here because a caller may reach the service without the settings
 * router, which is what otherwise proves the form is live and in this workspace.
 */
export const ensureSubmitterSettings = async (input: {
  workspaceId: string;
  formId: string;
}): Promise<void> => {
  const [form] = await db
    .select({ id: forms.id })
    .from(forms)
    .where(
      and(
        eq(forms.id, input.formId),
        eq(forms.workspaceId, input.workspaceId),
        isNull(forms.deletedAt),
      ),
    )
    .limit(1);
  if (!form) return;

  await db
    .insert(formSubmitterSettings)
    .values({
      workspaceId: input.workspaceId,
      formId: input.formId,
      createdBy: SETTINGS_AUTO_ACTOR,
      updatedBy: SETTINGS_AUTO_ACTOR,
    })
    .onConflictDoNothing({ target: formSubmitterSettings.formId });
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
