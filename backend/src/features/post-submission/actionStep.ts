import type { Logger } from 'pino';
import { db } from '../../core/db/client';
import { Features } from '../../core/db/codes';
import { readJobOutputs, type JobOutputRow } from '../../core/db/repos/jobOutputRepo';
import { extendJobResult } from '../../core/db/repos/jobRepo';
import type {
  PostSubmissionActionJob,
  PostSubmissionActionJobSettings,
  PostSubmissionActionPluginDefinition,
  PostSubmissionActionPreviousStep,
  PostSubmissionActionResult,
  PostSubmissionActionStoredResult,
  PostSubmissionActionSubmission,
} from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { getEnabledPostSubmissionActionCodes } from '../../core/integrations/post-submission-action/PostSubmissionActionRegistry';
import { JobCancelledError, JobFailedError } from '../../core/jobs/errors';
import type { JobFacts } from '../../core/jobs/facts';
import { resultFacts, type JobResultFacts } from '../../core/jobs/outputs';
import { getJobSettings } from '../../core/jobs/settings';
import { isFeatureAvailable } from '../../core/services/featureAvailabilityService';
import { actionServices } from './actionServices';
import { ActionJobParamsSchema } from './params';
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

/** What a step's plugin sees of its job. */
export const pluginJob = (
  job: JobFacts,
  submissionId: string,
  revisionId: string,
): PostSubmissionActionJob => ({
  id: job.id,
  type: job.type,
  submissionId,
  revisionId,
});

/** The result a step stored, as a later step sees it; null when it stored none or it is gone. */
const storedResult = (facts: JobResultFacts | null): PostSubmissionActionStoredResult | null =>
  facts?.state === 'ready'
    ? {
        filename: facts.filename,
        size: facts.size,
        contentType: facts.contentType,
        expiresAt: facts.expiresAt,
      }
    : null;

/**
 * The step before a later one, and the result it stored. It succeeded, since a step is queued with
 * the success of the one before, and retention keeps it until this one succeeds. Should it be gone,
 * the job ends cancelled.
 */
export const previousStep = (row: JobOutputRow | undefined): PostSubmissionActionPreviousStep => {
  if (!row) throw new JobCancelledError('The step before it is gone');
  return { jobId: row.jobId, result: storedResult(resultFacts(row)) };
};

/**
 * The step before, the job's parent, and its result, once the result's expiry is pushed to that
 * step's retention from now.
 */
const loadPreviousStep = async (
  { parentJobId }: JobFacts,
  before: PostSubmissionActionJobSettings,
): Promise<PostSubmissionActionPreviousStep> => {
  if (parentJobId === null) return previousStep(undefined);
  await extendJobResult(
    parentJobId,
    before.resultRetentionDays ?? getJobSettings().resultRetentionDays,
  );
  const [row] = await readJobOutputs([parentJobId]);
  return previousStep(row);
};

/** What running one step of an action takes from the code that runs it. */
export interface ActionStepInput {
  /** The step's job, a row in soba.job, which the Jobs tabs and the email audit read. */
  job: JobFacts;
  result: PostSubmissionActionResult;
  reportProgress: (done: number, total?: number | null) => void;
  signal: AbortSignal;
  log: Logger;
}

/**
 * Run one step of an action for its job: the start check, then the step before and its result when
 * `before` is set, then the step with the options recorded when the submission was received.
 * Returns once the step is done. Throws `JobCancelledError` when the feature or the action was turned
 * off or the submission is gone, which is how a queued action is stopped; what the step throws
 * passes through. It reads the submission, the settings and the step before itself and builds the
 * step's services; the result store, progress, signal and log come from the caller, so code other
 * than the job runner can run a step for its job.
 */
export const runActionStep = async (
  plugin: PostSubmissionActionPluginDefinition,
  step: PostSubmissionActionJobSettings,
  before: PostSubmissionActionJobSettings | undefined,
  input: ActionStepInput,
): Promise<void> => {
  const { job, signal, log } = input;
  const { facts, submission } = await runFacts(plugin, job);
  const reason = cancelReason(facts);
  if (reason || submission === null) throw new JobCancelledError(reason ?? SUBMISSION_GONE);
  if (job.revisionId === null) throw new JobFailedError('The action has no revision to run for');
  const previous = before ? await loadPreviousStep(job, before) : null;
  const params = ActionJobParamsSchema.parse(job.params);
  await step.run({
    job: pluginJob(job, submission.id, job.revisionId),
    previous,
    options: plugin.optionsSchema.parse(params.options),
    source: params.source,
    submission,
    services: actionServices(job, submission, signal, log),
    result: input.result,
    reportProgress: input.reportProgress,
    signal,
    log,
  });
};
