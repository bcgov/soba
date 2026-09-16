import type { SetSubmitterSettingsBody, SubmitterSettings } from '@soba/lib';
import { NotFoundError } from '../../../core/errors';
import type { FormSettingsContext, FormSettingsService } from '../routes';
import {
  ensureSubmitterSettings,
  findSubmitterSettings,
  updateSubmitterSettings,
  type SubmitterSettingsRecord,
} from './repo';

const SETTINGS_NOT_FOUND = 'Form submitter settings not found';

const toDto = (row: SubmitterSettingsRecord): SubmitterSettings => ({
  allowSubmitterDrafts: row.allowSubmitterDrafts,
});

const ensureRow = (ctx: FormSettingsContext, formId: string) =>
  ensureSubmitterSettings({ workspaceId: ctx.workspaceId, formId });

const writeRow = (ctx: FormSettingsContext, formId: string, body: SetSubmitterSettingsBody) =>
  updateSubmitterSettings({
    workspaceId: ctx.workspaceId,
    formId,
    allowSubmitterDrafts: body.allowSubmitterDrafts,
    actorDisplayLabel: ctx.actorDisplayLabel,
  });

/**
 * A form's submitter settings. Reads and saves go straight to the row; only a form without one
 * pays for the insert, which is a form created after the backfill migration. Other features read
 * these settings through `get`.
 */
export const submitterSettingsService: FormSettingsService<
  SubmitterSettings,
  SetSubmitterSettingsBody
> = {
  async get(ctx, formId) {
    let row = await findSubmitterSettings(ctx.workspaceId, formId);
    if (!row) {
      await ensureRow(ctx, formId);
      row = await findSubmitterSettings(ctx.workspaceId, formId);
    }
    if (!row) throw new NotFoundError(SETTINGS_NOT_FOUND);
    return toDto(row);
  },

  async set(ctx, formId, body) {
    let row = await writeRow(ctx, formId, body);
    if (!row) {
      await ensureRow(ctx, formId);
      row = await writeRow(ctx, formId, body);
    }
    if (!row) throw new NotFoundError(SETTINGS_NOT_FOUND);
    return toDto(row);
  },
};
