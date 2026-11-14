import { and, eq, type SQL } from 'drizzle-orm';
import {
  CONFIRMATION_SETTINGS_KEY,
  type ConfirmationSettings,
  type WorkspaceSettings,
} from '@soba/lib';
import { db, type DbOrTx } from '../../../core/db/client';
import { formConfirmationSettings, workspaceConfirmationSettings } from '../../../core/db/schema';
import type { InheritableRow } from '../inheritable';
import type { FormSettingsRowInput } from '../types';
import {
  saveSettingsRow,
  type SettingsSaveActor,
  type SettingsSaveStatus,
} from '../../../core/db/repos/settingsRow';

/** A form's confirmation settings row read with its workspace's. */
export interface FormConfirmationSettingsRow extends InheritableRow<ConfirmationSettings> {
  workspace: ConfirmationSettings;
}

/** Creates a new workspace's confirmation settings, every flag at its database default. */
export const createWorkspaceConfirmationSettings = async (
  input: { workspaceId: string; actorDisplayLabel: string | null },
  executor: DbOrTx,
): Promise<void> => {
  await executor.insert(workspaceConfirmationSettings).values({
    workspaceId: input.workspaceId,
    createdBy: input.actorDisplayLabel,
    updatedBy: input.actorDisplayLabel,
  });
};

/** Creates a new form's confirmation settings, inheriting its workspace's. */
export const createConfirmationSettings = async (
  input: FormSettingsRowInput,
  executor: DbOrTx,
): Promise<void> => {
  await executor.insert(formConfirmationSettings).values({
    workspaceId: input.workspaceId,
    formId: input.formId,
    createdBy: input.actorDisplayLabel,
    updatedBy: input.actorDisplayLabel,
  });
};

/** A workspace's confirmation settings and their version, or null when the workspace has no row. */
export const findWorkspaceConfirmationSettings = async (
  workspaceId: string,
): Promise<WorkspaceSettings<ConfirmationSettings> | null> => {
  const rows = await db
    .select({
      allowSubmitterEmailCopy: workspaceConfirmationSettings.allowSubmitterEmailCopy,
      version: workspaceConfirmationSettings.version,
    })
    .from(workspaceConfirmationSettings)
    .where(eq(workspaceConfirmationSettings.workspaceId, workspaceId))
    .limit(1);
  const row = rows[0];
  return row
    ? { values: { allowSubmitterEmailCopy: row.allowSubmitterEmailCopy }, version: row.version }
    : null;
};

/** Writes a workspace's confirmation settings if its row is still at `version`. */
export const updateWorkspaceConfirmationSettings = (input: {
  workspaceId: string;
  settings: ConfirmationSettings;
  version?: number;
  actorDisplayLabel: string | null;
  audit?: SettingsSaveActor;
}): Promise<SettingsSaveStatus> =>
  saveSettingsRow(
    workspaceConfirmationSettings,
    eq(workspaceConfirmationSettings.workspaceId, input.workspaceId),
    {
      allowSubmitterEmailCopy: input.settings.allowSubmitterEmailCopy,
      updatedBy: input.actorDisplayLabel,
      updatedAt: new Date(),
    },
    input.version,
    input.audit && {
      workspaceId: input.workspaceId,
      formId: null,
      groupKey: CONFIRMATION_SETTINGS_KEY,
      actorId: input.audit.actorId,
      actorDisplayLabel: input.actorDisplayLabel,
    },
  );

/** A form's confirmation settings with its workspace's, or null when either row is missing. */
export const findConfirmationSettings = async (
  workspaceId: string,
  formId: string,
): Promise<FormConfirmationSettingsRow | null> => {
  const rows = await db
    .select({
      inherit: formConfirmationSettings.inherit,
      allowSubmitterEmailCopy: formConfirmationSettings.allowSubmitterEmailCopy,
      version: formConfirmationSettings.version,
      workspaceAllowSubmitterEmailCopy: workspaceConfirmationSettings.allowSubmitterEmailCopy,
    })
    .from(formConfirmationSettings)
    .innerJoin(
      workspaceConfirmationSettings,
      eq(workspaceConfirmationSettings.workspaceId, formConfirmationSettings.workspaceId),
    )
    .where(
      and(
        eq(formConfirmationSettings.workspaceId, workspaceId),
        eq(formConfirmationSettings.formId, formId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    inherit: row.inherit,
    own:
      row.inherit || row.allowSubmitterEmailCopy == null
        ? null
        : { allowSubmitterEmailCopy: row.allowSubmitterEmailCopy },
    workspace: { allowSubmitterEmailCopy: row.workspaceAllowSubmitterEmailCopy },
    version: row.version,
  };
};

/**
 * Writes a form's confirmation settings if its row is still at `version`. Null settings inherit the
 * workspace's and clear the form's own.
 */
export const updateConfirmationSettings = (input: {
  workspaceId: string;
  formId: string;
  settings: ConfirmationSettings | null;
  version?: number;
  actorDisplayLabel: string | null;
  audit?: SettingsSaveActor;
}): Promise<SettingsSaveStatus> =>
  saveSettingsRow(
    formConfirmationSettings,
    and(
      eq(formConfirmationSettings.workspaceId, input.workspaceId),
      eq(formConfirmationSettings.formId, input.formId),
    ) as SQL,
    {
      inherit: input.settings == null,
      allowSubmitterEmailCopy: input.settings?.allowSubmitterEmailCopy ?? null,
      updatedBy: input.actorDisplayLabel,
      updatedAt: new Date(),
    },
    input.version,
    input.audit && {
      workspaceId: input.workspaceId,
      formId: input.formId,
      groupKey: CONFIRMATION_SETTINGS_KEY,
      actorId: input.audit.actorId,
      actorDisplayLabel: input.actorDisplayLabel,
    },
  );
