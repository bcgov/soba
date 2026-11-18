import {
  keepUnavailableSettings,
  type ConfirmationSettings,
  type FormConfirmationSettings,
  type SetFormConfirmationSettingsBody,
  type WorkspaceConfirmationSettings,
} from '@soba/lib';
import { NotFoundError } from '../../../core/errors';
import type { FeatureScopeContext } from '../../../core/services/featureAvailabilityService';
import { toInheritableSettings } from '../inheritable';
import { assertSaved } from '../saved';
import type { FormSettingsContext, FormSettingsService } from '../routes';
import { confirmationSettingAvailability } from './availability';
import {
  findConfirmationSettings,
  findWorkspaceConfirmationSettings,
  updateConfirmationSettings,
  updateWorkspaceConfirmationSettings,
} from './repo';

const FORM_NOT_FOUND = 'Form confirmation settings not found';
const WORKSPACE_NOT_FOUND = 'Workspace confirmation settings not found';

/** What a save writes: the values sent, with each setting whose feature is off left as it is. */
const valuesToSave = async (
  sent: ConfirmationSettings,
  current: ConfirmationSettings,
  scope: FeatureScopeContext,
): Promise<ConfirmationSettings> =>
  keepUnavailableSettings(sent, current, await confirmationSettingAvailability(scope));

const readForm = async (ctx: FormSettingsContext, formId: string) => {
  const row = await findConfirmationSettings(ctx.workspaceId, formId);
  if (!row) throw new NotFoundError(FORM_NOT_FOUND);
  return toInheritableSettings(row, row.workspace);
};

/** A form's confirmation settings: inherited from its workspace, or its own. */
export const formConfirmationSettingsService: FormSettingsService<
  FormConfirmationSettings,
  SetFormConfirmationSettingsBody
> = {
  get: readForm,

  async set(ctx, formId, body) {
    const settings =
      body.inherit === false
        ? await valuesToSave(body.values, (await readForm(ctx, formId)).effective, {
            workspaceId: ctx.workspaceId,
            formId,
          })
        : null;
    const status = await updateConfirmationSettings({
      workspaceId: ctx.workspaceId,
      formId,
      settings,
      version: body.version,
      actorDisplayLabel: ctx.actorDisplayLabel,
      audit: { actorId: ctx.actorId ?? null },
    });
    assertSaved(status, FORM_NOT_FOUND);
    return readForm(ctx, formId);
  },
};

const readWorkspace = async (ctx: FormSettingsContext) => {
  const settings = await findWorkspaceConfirmationSettings(ctx.workspaceId);
  if (!settings) throw new NotFoundError(WORKSPACE_NOT_FOUND);
  return settings;
};

/** A workspace's confirmation settings, which its forms inherit unless they set their own. */
export const workspaceConfirmationSettingsService: FormSettingsService<
  WorkspaceConfirmationSettings,
  WorkspaceConfirmationSettings
> = {
  get: readWorkspace,

  async set(ctx, _workspaceId, body) {
    const settings = await valuesToSave(body.values, (await readWorkspace(ctx)).values, {
      workspaceId: ctx.workspaceId,
    });
    const status = await updateWorkspaceConfirmationSettings({
      workspaceId: ctx.workspaceId,
      settings,
      version: body.version,
      actorDisplayLabel: ctx.actorDisplayLabel,
      audit: { actorId: ctx.actorId ?? null },
    });
    assertSaved(status, WORKSPACE_NOT_FOUND);
    return readWorkspace(ctx);
  },
};
