import type { SetSubmitterSettingsBody, SubmitterSettings } from '@soba/lib';
import { NotFoundError } from '../../../core/errors';
import type { FormSettingsContext, FormSettingsService } from '../routes';
import {
  findSubmitterSettings,
  updateSubmitterSettings,
  type SubmitterSettingsRecord,
} from './repo';

const SETTINGS_NOT_FOUND = 'Form submitter settings not found';

const toDto = (row: SubmitterSettingsRecord): SubmitterSettings => ({
  allowSubmitterDrafts: row.allowSubmitterDrafts,
});

const writeRow = (ctx: FormSettingsContext, formId: string, body: SetSubmitterSettingsBody) =>
  updateSubmitterSettings({
    workspaceId: ctx.workspaceId,
    formId,
    allowSubmitterDrafts: body.allowSubmitterDrafts,
    actorDisplayLabel: ctx.actorDisplayLabel,
  });

/** A form's submitter settings. Other features read them through `get`. */
export const submitterSettingsService: FormSettingsService<
  SubmitterSettings,
  SetSubmitterSettingsBody
> = {
  async get(ctx, formId) {
    const row = await findSubmitterSettings(ctx.workspaceId, formId);
    if (!row) throw new NotFoundError(SETTINGS_NOT_FOUND);
    return toDto(row);
  },

  async set(ctx, formId, body) {
    const row = await writeRow(ctx, formId, body);
    if (!row) throw new NotFoundError(SETTINGS_NOT_FOUND);
    return toDto(row);
  },
};
