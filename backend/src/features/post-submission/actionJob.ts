import { db } from '../../core/db/client';
import { Features } from '../../core/db/codes';
import type { ClaimedJob } from '../../core/db/repos/jobRepo';
import type { PostSubmissionActionPluginDefinition } from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { getEnabledPostSubmissionActionCodes } from '../../core/integrations/post-submission-action/PostSubmissionActionRegistry';
import { getPostSubmissionActionPluginDefinitions } from '../../core/integrations/plugins/PluginRegistry';
import type { JobTypeDefinition } from '../../core/jobs/registry';
import { JobCancelledError } from '../../core/jobs/settlement';
import { log } from '../../core/logging';
import { isFeatureAvailable } from '../../core/services/featureAvailabilityService';
import { ActionJobParamsSchema } from './params';
import { findActionSettingRows, isSubmissionLive } from './repo';
import { effectiveAction, rowsFor } from './rules';

/** What an action job checks before it runs. */
export interface ActionRunFacts {
  postSubmissionOn: boolean;
  enabledHere: boolean;
  featureAvailable: boolean;
  live: boolean;
  stillEnabled: boolean;
}

/** Why an action job should end cancelled instead of running; null to run it. */
export const cancelReason = (facts: ActionRunFacts): string | null => {
  if (!facts.postSubmissionOn) return 'The post-submission feature is off';
  if (!facts.enabledHere) return 'The action is not enabled in this environment';
  if (!facts.featureAvailable) return "The action's feature is not available for the form";
  if (!facts.live) return 'The submission, its form or its workspace is gone';
  if (!facts.stillEnabled) return 'The action was turned off';
  return null;
};

const runFacts = async (
  plugin: PostSubmissionActionPluginDefinition,
  job: ClaimedJob,
): Promise<ActionRunFacts> => {
  const scope = { workspaceId: job.workspaceId, formId: job.formId ?? undefined };
  const [postSubmissionOn, featureAvailable, live, rows] = await Promise.all([
    isFeatureAvailable(Features.post_submission, scope),
    plugin.featureCode ? isFeatureAvailable(plugin.featureCode, scope) : Promise.resolve(true),
    job.submissionId === null
      ? Promise.resolve(false)
      : isSubmissionLive(db, { workspaceId: job.workspaceId, submissionId: job.submissionId }),
    job.formId === null
      ? Promise.resolve([])
      : findActionSettingRows(db, job.workspaceId, job.formId),
  ]);
  const { workspaceRow, formRow } = rowsFor(rows, plugin.code);
  return {
    postSubmissionOn,
    enabledHere: getEnabledPostSubmissionActionCodes().includes(plugin.code),
    featureAvailable,
    live,
    stillEnabled: effectiveAction(workspaceRow, formRow, plugin.scopes).values.enabled,
  };
};

/**
 * The job type for one action plugin. Before the plugin runs, the job ends cancelled if the
 * feature or the action was turned off, or the submission is gone; that is how a queued action is
 * stopped. The options are the ones recorded when the submission was received.
 */
export const actionJobDefinition = (
  plugin: PostSubmissionActionPluginDefinition,
): JobTypeDefinition => ({
  type: plugin.code,
  pool: plugin.job.pool,
  maxAttempts: plugin.job.maxAttempts,
  timeoutMs: plugin.job.timeoutMs,
  run: async ({ job, signal, log }) => {
    const reason = cancelReason(await runFacts(plugin, job));
    if (reason) throw new JobCancelledError(reason);
    const params = ActionJobParamsSchema.parse(job.params);
    const options = plugin.optionsSchema.parse(params.options);
    await plugin.job.run({ job, options, source: params.source, signal, log });
  },
});

/**
 * One job type per installed action plugin; the start check cancels those not enabled here. Warns
 * once about enabled codes with no plugin; those never run.
 */
export const postSubmissionActionJobs = (): JobTypeDefinition[] => {
  const installed = getPostSubmissionActionPluginDefinitions();
  const notInstalled = getEnabledPostSubmissionActionCodes().filter(
    (code) => !installed.some((plugin) => plugin.code === code),
  );
  if (notInstalled.length > 0) {
    log.warn({ codes: notInstalled }, 'POST_SUBMISSION_ACTION_PLUGINS names plugins not installed');
  }
  return installed.map(actionJobDefinition);
};
