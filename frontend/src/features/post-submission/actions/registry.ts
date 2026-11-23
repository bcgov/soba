import { postSubmissionActionStepType } from '@soba/lib';
import type { Dictionary } from '@/src/types/dictionary';
import { POST_SUBMISSION_EMAIL_PACKAGE_CODE } from '@/src/types/postSubmission';
import { emailAddressesAction } from './email';
import { emailPackageAction } from './email-package';
import { logAction } from './log';
import type { PostSubmissionActionUi } from './types';

/** The actions this build has fields for, by plugin code. Add an action here to give it a drawer. */
const actions = new Map<string, PostSubmissionActionUi>([
  ['post-submission-email-addresses', emailAddressesAction],
  [POST_SUBMISSION_EMAIL_PACKAGE_CODE, emailPackageAction],
  ['post-submission-log', logAction],
]);

/** An action's later step, by its job type: the action, and the step's own name. */
export interface PostSubmissionActionStep {
  action: PostSubmissionActionUi;
  label: (dict: Dictionary) => string;
}

const steps = new Map<string, PostSubmissionActionStep>(
  [...actions].flatMap(([code, action]) =>
    Object.entries(action.stepLabels ?? {}).map(
      ([step, label]) => [postSubmissionActionStepType(code, step), { action, label }] as const,
    ),
  ),
);

/** How the tab shows an action; undefined for one this build has no fields for. */
export const postSubmissionActionUi = (code: string): PostSubmissionActionUi | undefined =>
  actions.get(code);

/** An action's later step by its job type; undefined for a type this build does not name. */
export const postSubmissionActionStep = (type: string): PostSubmissionActionStep | undefined =>
  steps.get(type);

/** The job types of the actions this build has fields for: each action's, then its named steps'. */
export const postSubmissionJobTypes = (): string[] =>
  [...actions].flatMap(([code, action]) => [
    code,
    ...Object.keys(action.stepLabels ?? {}).map((step) => postSubmissionActionStepType(code, step)),
  ]);
