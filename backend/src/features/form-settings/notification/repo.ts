import { and, eq } from 'drizzle-orm';
import { NOTIFICATION_SETTINGS_KEY, type NotificationSettings } from '@soba/lib';
import { db, type DbOrTx } from '../../../core/db/client';
import { formNotificationSettings } from '../../../core/db/schema';
import { saveSettingsRow, type SettingsSaveActor } from '../../../core/db/repos/settingsRow';
import type { FormSettingsRowInput } from '../types';

export const createNotificationSettings = async (
  input: FormSettingsRowInput,
  executor: DbOrTx,
): Promise<void> => {
  await executor.insert(formNotificationSettings).values({
    workspaceId: input.workspaceId,
    formId: input.formId,
    createdBy: input.actorDisplayLabel,
    updatedBy: input.actorDisplayLabel,
  });
};
const whereForm = (workspaceId: string, formId: string) =>
  and(
    eq(formNotificationSettings.workspaceId, workspaceId),
    eq(formNotificationSettings.formId, formId),
  );
export const findNotificationSettings = async (workspaceId: string, formId: string) => {
  const [row] = await db
    .select({
      recipients: formNotificationSettings.recipients,
      version: formNotificationSettings.version,
    })
    .from(formNotificationSettings)
    .where(whereForm(workspaceId, formId))
    .limit(1);
  return row ? { values: { recipients: row.recipients }, version: row.version } : null;
};
export const updateNotificationSettings = (input: {
  workspaceId: string;
  formId: string;
  settings: NotificationSettings;
  version: number;
  actorDisplayLabel: string | null;
  audit: SettingsSaveActor;
}) =>
  saveSettingsRow(
    formNotificationSettings,
    whereForm(input.workspaceId, input.formId),
    {
      recipients: input.settings.recipients,
      updatedBy: input.actorDisplayLabel,
      updatedAt: new Date(),
    },
    input.version,
    {
      workspaceId: input.workspaceId,
      formId: input.formId,
      groupKey: NOTIFICATION_SETTINGS_KEY,
      actorId: input.audit.actorId,
      actorDisplayLabel: input.actorDisplayLabel,
    },
  );
