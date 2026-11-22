import type { ChildJob } from '../../core/db/repos/jobRepo';
import type {
  PostSubmissionActionJobSettings,
  PostSubmissionActionPluginDefinition,
} from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { actionStepType } from '../../core/integrations/post-submission-action/PostSubmissionActionRegistry';
import { getPostSubmissionActionPluginDefinitions } from '../../core/integrations/plugins/PluginRegistry';
import type { JobFacts } from '../../core/jobs/facts';
import type { JobTypeDefinition } from '../../core/jobs/registry';
import { getJobSettings } from '../../core/jobs/settings';
import { actionResult } from './actionServices';
import { runActionStep } from './actionStep';
import { ActionJobParamsSchema, type ActionJobParams } from './params';

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
 * The job type for one step of an action, which `runActionStep` runs. The next step is queued in the
 * transaction that records this one as succeeded.
 */
const stepJobDefinition = (
  plugin: PostSubmissionActionPluginDefinition,
  step: ActionStep,
  before: ActionStep | undefined,
  next: ActionStep | undefined,
): JobTypeDefinition => ({
  type: step.type,
  pool: step.pool,
  maxAttempts: step.maxAttempts,
  timeoutMs: step.timeoutMs,
  resultRetentionDays: step.resultRetentionDays,
  run: async ({
    job,
    signal,
    log,
    reportProgress,
    resultMaxBytes,
    storeResult,
    queueOnSuccess,
  }) => {
    await runActionStep(plugin, step, before, {
      job,
      result: actionResult({ resultMaxBytes, storeResult }),
      reportProgress,
      signal,
      log,
    });
    if (next) queueOnSuccess([nextStepJob(job, next, ActionJobParamsSchema.parse(job.params))]);
  },
});

/** The job types for one action plugin: one per step. */
export const actionJobDefinitions = (
  plugin: PostSubmissionActionPluginDefinition,
): JobTypeDefinition[] => {
  const steps = actionSteps(plugin);
  return steps.map((step, index) =>
    stepJobDefinition(plugin, step, index > 0 ? steps[index - 1] : undefined, steps[index + 1]),
  );
};

/** The job types for every installed action plugin; the start check cancels those not enabled here. */
export const postSubmissionActionJobs = (): JobTypeDefinition[] =>
  getPostSubmissionActionPluginDefinitions().flatMap(actionJobDefinitions);
