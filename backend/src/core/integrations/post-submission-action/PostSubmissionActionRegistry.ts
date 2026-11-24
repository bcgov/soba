import { env } from '../../config/env';
import { getPostSubmissionActionPluginDefinitions } from '../plugins/PluginRegistry';
import type { PostSubmissionActionPluginDefinition } from './PostSubmissionActionPluginDefinition';

/** POST_SUBMISSION_ACTION_PLUGINS: the action codes this environment runs, in order. */
export const getEnabledPostSubmissionActionCodes = (): string[] => [
  ...new Set(env.getPostSubmissionActionPlugins()),
];

/** The installed action plugins this environment enables, in POST_SUBMISSION_ACTION_PLUGINS order. */
export const getPostSubmissionActions = (): PostSubmissionActionPluginDefinition[] => {
  const enabled = getEnabledPostSubmissionActionCodes();
  if (enabled.length === 0) return [];
  const installed = new Map(
    getPostSubmissionActionPluginDefinitions().map((definition) => [definition.code, definition]),
  );
  return enabled.flatMap((code) => {
    const definition = installed.get(code);
    return definition ? [definition] : [];
  });
};

/**
 * Throws when POST_SUBMISSION_ACTION_PLUGINS names a code with no installed plugin, such as one that
 * failed to load, since a submission received meanwhile would never queue that action.
 */
export const assertPostSubmissionActionsInstalled = (): void => {
  const installed = new Set(
    getPostSubmissionActionPluginDefinitions().map((plugin) => plugin.code),
  );
  const missing = getEnabledPostSubmissionActionCodes().filter((code) => !installed.has(code));
  if (missing.length > 0) {
    throw new Error(
      `POST_SUBMISSION_ACTION_PLUGINS names plugins that are not installed or did not load: ${missing.join(', ')}`,
    );
  }
};

/** An enabled, installed action plugin by code. */
export const findPostSubmissionAction = (
  code: string,
): PostSubmissionActionPluginDefinition | undefined =>
  getPostSubmissionActions().find((definition) => definition.code === code);

/** An installed action plugin by code, enabled here or not. A pod older than the plugin has none. */
export const findInstalledPostSubmissionAction = (
  code: string,
): PostSubmissionActionPluginDefinition | undefined =>
  getPostSubmissionActionPluginDefinitions().find((definition) => definition.code === code);
