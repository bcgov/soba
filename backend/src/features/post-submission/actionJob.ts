import { db } from '../../core/db/client';
import { Features } from '../../core/db/codes';
import { readJobOutputs, type JobOutputRow } from '../../core/db/repos/jobOutputRepo';
import type { ChildJob } from '../../core/db/repos/jobRepo';
import type {
  PostSubmissionActionJobSettings,
  PostSubmissionActionPluginDefinition,
  PostSubmissionActionPreviousStep,
  PostSubmissionActionSubmission,
} from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import {
  actionStepType,
  getEnabledPostSubmissionActionCodes,
} from '../../core/integrations/post-submission-action/PostSubmissionActionRegistry';
import { getPostSubmissionActionPluginDefinitions } from '../../core/integrations/plugins/PluginRegistry';
import { JobCancelledError, JobFailedError } from '../../core/jobs/errors';
import type { JobFacts } from '../../core/jobs/facts';
import { resultFacts } from '../../core/jobs/outputs';
import type { JobTypeDefinition } from '../../core/jobs/registry';
import { getJobSettings } from '../../core/jobs/settings';
import { log } from '../../core/logging';
import { isFeatureAvailable } from '../../core/services/featureAvailabilityService';
import { ActionJobParamsSchema, type ActionJobParams } from './params';
import { findActionSettingRows, findLiveSubmission, SUBMISSION_GONE } from './repo';
import { actionFeatureAvailable, isWorkspaceConfigurable } from './resolve';
import { effectiveAction, formActionScopes, rowsFor } from './rules';

/** What an action job checks before it runs. */
export interface ActionRunFacts {
  postSubmissionAvailable: boolean;
  enabledHere: boolean;
  featureAvailable: boolean;
  live: boolean;
  stillEnabled: boolean;
}

/** Why an action job should end cancelled instead of running; null to run it. */
export const cancelReason = (facts: ActionRunFacts): string | null => {
  if (!facts.postSubmissionAvailable) return 'Post-submission is not available for the form';
  if (!facts.enabledHere) return 'The action is not enabled in this environment';
  if (!facts.featureAvailable) return "The action's feature is not available for the form";
  if (!facts.live) return SUBMISSION_GONE;
  if (!facts.stillEnabled) return 'The action was turned off';
  return null;
};

const runFacts = async (
  plugin: PostSubmissionActionPluginDefinition,
  job: JobFacts,
): Promise<{ facts: ActionRunFacts; submission: PostSubmissionActionSubmission | null }> => {
  const scope = { workspaceId: job.workspaceId, formId: job.formId ?? undefined };
  const [postSubmissionAvailable, featureAvailable, workspaceConfigurable, submission, rows] =
    await Promise.all([
      isFeatureAvailable(Features.post_submission, scope),
      actionFeatureAvailable(plugin, scope),
      isWorkspaceConfigurable(plugin, job.workspaceId),
      job.submissionId === null
        ? Promise.resolve(null)
        : findLiveSubmission(db, { workspaceId: job.workspaceId, submissionId: job.submissionId }),
      job.formId === null
        ? Promise.resolve([])
        : findActionSettingRows(db, job.workspaceId, job.formId),
    ]);
  const { workspaceRow, formRow } = rowsFor(rows, plugin.code);
  const scopes = formActionScopes(plugin.scopes, workspaceConfigurable);
  return {
    facts: {
      postSubmissionAvailable,
      enabledHere: getEnabledPostSubmissionActionCodes().includes(plugin.code),
      featureAvailable,
      live: submission !== null,
      stillEnabled: effectiveAction(workspaceRow, formRow, scopes).values.enabled,
    },
    submission,
  };
};

/** One step of an action, as a job type. */
interface ActionStep extends PostSubmissionActionJobSettings {
  type: string;
}

/** An action's steps in order: the first typed by its code, each later one by `<code>:<name>`. */
const actionSteps = (plugin: PostSubmissionActionPluginDefinition): ActionStep[] => [
  { ...plugin.job, type: plugin.code },
  ...(plugin.steps ?? []).map((step) => ({
    ...step,
    type: actionStepType(plugin.code, step.name),
  })),
];

/**
 * The step before a later one, and the result it stored. It succeeded, since a step is queued with
 * the success of the one before; the job ends cancelled when retention has deleted that one.
 */
export const previousStep = (row: JobOutputRow | undefined): PostSubmissionActionPreviousStep => {
  if (!row) throw new JobCancelledError('The step before it is gone');
  return { jobId: row.jobId, result: resultFacts(row) };
};

const loadPreviousStep = async ({
  parentJobId,
}: JobFacts): Promise<PostSubmissionActionPreviousStep> => {
  const [row] = parentJobId === null ? [] : await readJobOutputs([parentJobId]);
  return previousStep(row);
};

/** The next step's job: a child of this step's job with its params as stored, one per parent. */
export const nextStepJob = (
  job: JobFacts,
  next: ActionStep,
  params: ActionJobParams,
): ChildJob => ({
  type: next.type,
  formId: job.formId,
  submissionId: job.submissionId,
  revisionId: job.revisionId,
  actionConfigId: params.source.settingId,
  createdBy: job.createdBy,
  params: job.params,
  dedupeKey: `${next.type}:${job.id}`,
  maxAttempts: next.maxAttempts ?? getJobSettings().maxAttempts,
});

/**
 * The job type for one step of an action. Before the step runs, the job ends cancelled if the
 * feature or the action was turned off, or the submission is gone; that is how a queued action is
 * stopped. The options are the ones recorded when the submission was received. A later step gets
 * the step before it; the next step is queued in the transaction that records this one as
 * succeeded.
 */
const stepJobDefinition = (
  plugin: PostSubmissionActionPluginDefinition,
  step: ActionStep,
  index: number,
  next: ActionStep | undefined,
): JobTypeDefinition => ({
  type: step.type,
  pool: step.pool,
  maxAttempts: step.maxAttempts,
  timeoutMs: step.timeoutMs,
  resultRetentionDays: step.resultRetentionDays,
  keepResultWhenEnded: step.keepResultWhenEnded,
  run: async ({
    job,
    signal,
    log,
    reportProgress,
    resultMaxBytes,
    storeResult,
    queueOnSuccess,
  }) => {
    const { facts, submission } = await runFacts(plugin, job);
    const reason = cancelReason(facts);
    if (reason || submission === null) throw new JobCancelledError(reason ?? SUBMISSION_GONE);
    if (job.revisionId === null) throw new JobFailedError('The action has no revision to run for');
    const previous = index === 0 ? null : await loadPreviousStep(job);
    const params = ActionJobParamsSchema.parse(job.params);
    const options = plugin.optionsSchema.parse(params.options);
    // Loaded on run: the services import the submission service, whose module loads the job
    // catalog, which imports this module.
    const { actionResult, actionServices } = await import('./actionServices');
    await step.run({
      job: { ...job, submissionId: submission.id, revisionId: job.revisionId },
      previous,
      options,
      source: params.source,
      submission,
      services: actionServices(job, submission, signal, log),
      result: actionResult({ resultMaxBytes, storeResult }),
      reportProgress,
      signal,
      log,
    });
    if (next) queueOnSuccess([nextStepJob(job, next, params)]);
  },
});

/** The job types for one action plugin: one per step. */
export const actionJobDefinitions = (
  plugin: PostSubmissionActionPluginDefinition,
): JobTypeDefinition[] => {
  const steps = actionSteps(plugin);
  return steps.map((step, index) => stepJobDefinition(plugin, step, index, steps[index + 1]));
};

/**
 * The job types for every installed action plugin; the start check cancels those not enabled here.
 * Warns once about enabled codes with no plugin; those never run.
 */
export const postSubmissionActionJobs = (): JobTypeDefinition[] => {
  const installed = getPostSubmissionActionPluginDefinitions();
  const notInstalled = getEnabledPostSubmissionActionCodes().filter(
    (code) => !installed.some((plugin) => plugin.code === code),
  );
  if (notInstalled.length > 0) {
    log.warn({ codes: notInstalled }, 'POST_SUBMISSION_ACTION_PLUGINS names plugins not installed');
  }
  return installed.flatMap(actionJobDefinitions);
};
