import { db } from '../../../core/db/client';
import { NotFoundError, ValidationError } from '../../../core/errors';
import type { PostSubmissionActionPluginDefinition } from '../../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import {
  findPostSubmissionAction,
  getPostSubmissionActions,
} from '../../../core/integrations/post-submission-action/PostSubmissionActionRegistry';
import { isFeatureAvailable } from '../../../core/services/featureAvailabilityService';
import { assertSaved } from '../../form-settings/saved';
import { findActionSettingRows, saveActionSetting } from '../repo';
import {
  rowsFor,
  toFormActionSettings,
  toWorkspaceActionSettings,
  type ActionSettingRow,
  type ActionValues,
  type FormActionSettings,
  type WorkspaceActionSettings,
} from '../rules';
import type { SetFormActionBody, SetWorkspaceActionBody } from './schema';

/** Who is reading or saving, and where: a form, or the workspace's defaults when formId is null. */
export interface ActionScopeContext {
  workspaceId: string;
  formId: string | null;
  actorId: string;
  actorDisplayLabel: string | null;
}

type ActionSettings = FormActionSettings | WorkspaceActionSettings;

const NOT_FOUND = 'Post-submission action not found';

/** An action is configurable where its plugin allows the scope and its feature is available. */
const isConfigurable = async (
  plugin: PostSubmissionActionPluginDefinition,
  ctx: ActionScopeContext,
): Promise<boolean> => {
  if (ctx.formId === null && !plugin.scopes.includes('workspace')) return false;
  if (!plugin.featureCode) return true;
  return isFeatureAvailable(plugin.featureCode, {
    workspaceId: ctx.workspaceId,
    formId: ctx.formId ?? undefined,
  });
};

const requireAction = async (
  code: string,
  ctx: ActionScopeContext,
): Promise<PostSubmissionActionPluginDefinition> => {
  const plugin = findPostSubmissionAction(code);
  if (!plugin || !(await isConfigurable(plugin, ctx))) throw new NotFoundError(NOT_FOUND);
  return plugin;
};

/** The options the plugin's schema accepts. An action that is off may keep none. */
export const checkedOptions = (
  plugin: PostSubmissionActionPluginDefinition,
  values: ActionValues,
): Record<string, unknown> => {
  if (!values.enabled && Object.keys(values.options).length === 0) return {};
  const parsed = plugin.optionsSchema.safeParse(values.options);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'options'}: ${issue.message}`)
      .join('; ');
    throw new ValidationError(`Invalid options for ${plugin.code}: ${detail}`);
  }
  return parsed.data;
};

const viewOf = (
  plugin: PostSubmissionActionPluginDefinition,
  rows: readonly ActionSettingRow[],
  ctx: ActionScopeContext,
): ActionSettings => {
  const { workspaceRow, formRow } = rowsFor(rows, plugin.code);
  return ctx.formId === null
    ? toWorkspaceActionSettings(workspaceRow)
    : toFormActionSettings(workspaceRow, formRow, plugin.scopes);
};

const read = async (
  plugin: PostSubmissionActionPluginDefinition,
  ctx: ActionScopeContext,
): Promise<ActionSettings> =>
  viewOf(plugin, await findActionSettingRows(db, ctx.workspaceId, ctx.formId), ctx);

/** The actions configurable at this scope, each with its settings. */
export const listActions = async (ctx: ActionScopeContext) => {
  const plugins = getPostSubmissionActions();
  const configurable = await Promise.all(plugins.map((plugin) => isConfigurable(plugin, ctx)));
  const rows = await findActionSettingRows(db, ctx.workspaceId, ctx.formId);
  return {
    actions: plugins
      .filter((_plugin, index) => configurable[index])
      .map((plugin) => ({
        code: plugin.code,
        name: plugin.metadata.name,
        description: plugin.metadata.description,
        scopes: plugin.scopes,
        settings: viewOf(plugin, rows, ctx),
      })),
  };
};

export const getAction = async (code: string, ctx: ActionScopeContext) =>
  read(await requireAction(code, ctx), ctx);

const save = async (
  plugin: PostSubmissionActionPluginDefinition,
  ctx: ActionScopeContext,
  values: ActionValues | null,
  version: number,
) => {
  const status = await saveActionSetting({
    workspaceId: ctx.workspaceId,
    formId: ctx.formId,
    code: plugin.code,
    values: values && { enabled: values.enabled, options: checkedOptions(plugin, values) },
    version,
    actorDisplayLabel: ctx.actorDisplayLabel,
    audit: { actorId: ctx.actorId },
  });
  assertSaved(status, NOT_FOUND);
  return read(plugin, ctx);
};

/** A form's own values; null when it inherits. An action without a form scope takes none. */
export const formOwnValues = (
  plugin: PostSubmissionActionPluginDefinition,
  body: SetFormActionBody,
): ActionValues | null => {
  if (!('values' in body)) return null;
  if (!plugin.scopes.includes('form')) {
    throw new ValidationError(`${plugin.code} is set for the workspace only`);
  }
  return body.values;
};

/** A form inherits the workspace's settings for the action, or keeps its own. */
export const setFormAction = async (
  code: string,
  ctx: ActionScopeContext,
  body: SetFormActionBody,
) => {
  const plugin = await requireAction(code, ctx);
  return save(plugin, ctx, formOwnValues(plugin, body), body.version);
};

/** The workspace's default for the action, which its forms inherit unless they set their own. */
export const setWorkspaceAction = async (
  code: string,
  ctx: ActionScopeContext,
  body: SetWorkspaceActionBody,
) => save(await requireAction(code, ctx), ctx, body.values, body.version);
