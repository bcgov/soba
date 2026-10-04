import { and, eq } from 'drizzle-orm';
import type { SubmitterSettings } from '@soba/lib';
import { db, type DbOrTx } from '../../../core/db/client';
import { formSubmitterSettings, workspaceSubmitterSettings } from '../../../core/db/schema';
import type { InheritableRow } from '../inheritable';

/** A form's submitter settings row read with its workspace's. */
export interface FormSubmitterSettingsRow extends InheritableRow<SubmitterSettings> {
  workspace: SubmitterSettings;
}

/** Creates a new workspace's submitter settings, every flag at its database default. */
export const createWorkspaceSubmitterSettings = async (
  input: { workspaceId: string; actorDisplayLabel: string | null },
  executor: DbOrTx,
): Promise<void> => {
  await executor.insert(workspaceSubmitterSettings).values({
    workspaceId: input.workspaceId,
    createdBy: input.actorDisplayLabel,
    updatedBy: input.actorDisplayLabel,
  });
};

/** Creates a new form's submitter settings, inheriting its workspace's. */
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

/** A workspace's submitter settings, or null when the workspace has no row. */
export const findWorkspaceSubmitterSettings = async (
  workspaceId: string,
): Promise<SubmitterSettings | null> => {
  const rows = await db
    .select({ allowSubmitterDrafts: workspaceSubmitterSettings.allowSubmitterDrafts })
    .from(workspaceSubmitterSettings)
    .where(eq(workspaceSubmitterSettings.workspaceId, workspaceId))
    .limit(1);
  return rows[0] ?? null;
};

/** Writes a workspace's submitter settings; null when the workspace has no row. */
export const updateWorkspaceSubmitterSettings = async (input: {
  workspaceId: string;
  settings: SubmitterSettings;
  actorDisplayLabel: string | null;
}): Promise<SubmitterSettings | null> => {
  const rows = await db
    .update(workspaceSubmitterSettings)
    .set({
      allowSubmitterDrafts: input.settings.allowSubmitterDrafts,
      updatedBy: input.actorDisplayLabel,
      updatedAt: new Date(),
    })
    .where(eq(workspaceSubmitterSettings.workspaceId, input.workspaceId))
    .returning({ allowSubmitterDrafts: workspaceSubmitterSettings.allowSubmitterDrafts });
  return rows[0] ?? null;
};

/** A form's submitter settings with its workspace's, or null when either row is missing. */
export const findSubmitterSettings = async (
  workspaceId: string,
  formId: string,
): Promise<FormSubmitterSettingsRow | null> => {
  const rows = await db
    .select({
      inherit: formSubmitterSettings.inherit,
      allowSubmitterDrafts: formSubmitterSettings.allowSubmitterDrafts,
      workspaceAllowSubmitterDrafts: workspaceSubmitterSettings.allowSubmitterDrafts,
    })
    .from(formSubmitterSettings)
    .innerJoin(
      workspaceSubmitterSettings,
      eq(workspaceSubmitterSettings.workspaceId, formSubmitterSettings.workspaceId),
    )
    .where(
      and(
        eq(formSubmitterSettings.workspaceId, workspaceId),
        eq(formSubmitterSettings.formId, formId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    inherit: row.inherit,
    own:
      row.inherit || row.allowSubmitterDrafts == null
        ? null
        : { allowSubmitterDrafts: row.allowSubmitterDrafts },
    workspace: { allowSubmitterDrafts: row.workspaceAllowSubmitterDrafts },
  };
};

/**
 * Writes a form's submitter settings. Null settings inherit the workspace's and clear the form's
 * own. Returns false when the form has no row in this workspace.
 */
export const updateSubmitterSettings = async (input: {
  workspaceId: string;
  formId: string;
  settings: SubmitterSettings | null;
  actorDisplayLabel: string | null;
}): Promise<boolean> => {
  const rows = await db
    .update(formSubmitterSettings)
    .set({
      inherit: input.settings == null,
      allowSubmitterDrafts: input.settings?.allowSubmitterDrafts ?? null,
      updatedBy: input.actorDisplayLabel,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(formSubmitterSettings.workspaceId, input.workspaceId),
        eq(formSubmitterSettings.formId, input.formId),
      ),
    )
    .returning({ id: formSubmitterSettings.id });
  return rows.length > 0;
};
