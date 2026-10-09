import type { FormNotificationSettings } from '@soba/lib';
import { NotFoundError } from '../../../core/errors';
import type { FormSettingsContext, FormSettingsService } from '../routes';
import { assertSaved } from '../saved';
import { findNotificationSettings, updateNotificationSettings } from './repo';
const NOT_FOUND = 'Form notification settings not found';
const read = async (ctx: FormSettingsContext, formId: string) => {
  const settings = await findNotificationSettings(ctx.workspaceId, formId);
  if (!settings) throw new NotFoundError(NOT_FOUND);
  return settings;
};
export const formNotificationSettingsService: FormSettingsService<
  FormNotificationSettings,
  FormNotificationSettings
> = {
  get: read,
  async set(ctx, formId, body) {
    assertSaved(
      await updateNotificationSettings({
        workspaceId: ctx.workspaceId,
        formId,
        settings: body.values,
        version: body.version,
        actorDisplayLabel: ctx.actorDisplayLabel,
        audit: { actorId: ctx.actorId ?? null },
      }),
      NOT_FOUND,
    );
    return read(ctx, formId);
  },
};
