import type { DbOrTx } from '../../core/db/client';
import type {
  PostSubmissionActionPluginDefinition,
  PostSubmissionActionSource,
} from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { getPostSubmissionActions } from '../../core/integrations/post-submission-action/PostSubmissionActionRegistry';
import { isFeatureAvailable } from '../../core/services/featureAvailabilityService';
import { findActionSettingRows } from './repo';
import { effectiveAction, rowsFor, type ActionSettingRow } from './rules';

/** An action a submission runs, with the options saved when it was submitted. */
export interface SubmittedAction {
  code: string;
  options: Record<string, unknown>;
  source: PostSubmissionActionSource;
}

/**
 * The action plugins enabled here whose feature is available for the form. Feature checks read on
 * the pool, so a submit runs this before its transaction takes a connection.
 */
export const availableActions = async (
  workspaceId: string,
  formId: string,
): Promise<PostSubmissionActionPluginDefinition[]> => {
  const plugins = getPostSubmissionActions();
  const available = await Promise.all(
    plugins.map((plugin) =>
      plugin.featureCode
        ? isFeatureAvailable(plugin.featureCode, { workspaceId, formId })
        : Promise.resolve(true),
    ),
  );
  return plugins.filter((_plugin, index) => available[index]);
};

/** The actions to record with a submission: each available plugin whose settings turn it on. */
export const chooseSubmittedActions = (
  rows: readonly ActionSettingRow[],
  plugins: readonly PostSubmissionActionPluginDefinition[],
): SubmittedAction[] =>
  plugins.flatMap((plugin) => {
    const { workspaceRow, formRow } = rowsFor(rows, plugin.code);
    const { values, source } = effectiveAction(workspaceRow, formRow, plugin.scopes);
    return values.enabled && source ? [{ code: plugin.code, options: values.options, source }] : [];
  });

/** The actions in effect for a form now, read on the submit's transaction. */
export const resolveSubmittedActions = async (
  executor: DbOrTx,
  workspaceId: string,
  formId: string,
  plugins: readonly PostSubmissionActionPluginDefinition[],
): Promise<SubmittedAction[]> => {
  if (plugins.length === 0) return [];
  const rows = await findActionSettingRows(executor, workspaceId, formId);
  return chooseSubmittedActions(rows, plugins);
};
