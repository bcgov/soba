import {
  SubmissionParticipantRole,
  SubmissionWorkflowState,
  type SubmissionWorkflowStateCode,
} from './codes';

/** What a submitter's own submissions list says about one of them. */
export interface SubmitterSubmissionFacts {
  workflowState: string;
  /** The caller's grant on the submission. */
  role: string;
}

/**
 * The states before a submission is submitted: continued rather than viewed, open to file uploads,
 * and deletable by its owner.
 */
export const SUBMISSION_IN_PROGRESS_STATES: readonly SubmissionWorkflowStateCode[] = [
  SubmissionWorkflowState.opened,
  SubmissionWorkflowState.draft,
];

/** Whether the submission is in progress: continued, not viewed. */
export const isSubmissionInProgress = (workflowState: string): boolean =>
  (SUBMISSION_IN_PROGRESS_STATES as readonly string[]).includes(workflowState);

/** Whether the caller deletes the submission: they own it, and it is in progress. */
export const canDeleteOwnSubmission = (facts: SubmitterSubmissionFacts): boolean =>
  facts.role === SubmissionParticipantRole.owner && isSubmissionInProgress(facts.workflowState);
