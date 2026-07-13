import {
  SubmissionEventType,
  SubmissionWorkflowState,
  type SubmissionEventTypeCode,
  type SubmissionWorkflowStateCode,
} from '../db/codes';
import { ConflictError } from '../errors';

/**
 * In-process submission lifecycle policy: given the submission's current state and the operation
 * performed, decide the resulting state and reject illegal transitions.
 *
 * This is a deliberate seam. When the workflow engine (Temporal) lands, the transition decision moves
 * there and this module retires; keeping it pure (no I/O, no db) makes that port mechanical. Callers
 * pass the current state read from the row and the event they are recording — nothing here reads or
 * writes state itself.
 *
 * Flow: opened --saved--> draft --saved--> draft --submitted--> submitted.
 * Terminal states (submitted, deleted) accept no further edits or submits.
 */

const TERMINAL_STATES: ReadonlySet<string> = new Set([
  SubmissionWorkflowState.submitted,
  SubmissionWorkflowState.deleted,
]);

/** The state each recordable event drives a non-terminal submission into. */
const TARGET_STATE: Record<SubmissionEventTypeCode, SubmissionWorkflowStateCode> = {
  [SubmissionEventType.opened]: SubmissionWorkflowState.opened,
  [SubmissionEventType.saved]: SubmissionWorkflowState.draft,
  [SubmissionEventType.submitted]: SubmissionWorkflowState.submitted,
};

/**
 * Resolve the workflow state a `saved`/`submitted` event moves the submission into. Throws
 * ConflictError (409) when the submission is already terminal, so an expected denial never surfaces
 * as a 500.
 */
export const resolveSubmissionTransition = (
  current: string,
  event: SubmissionEventTypeCode,
): SubmissionWorkflowStateCode => {
  if (TERMINAL_STATES.has(current)) {
    throw new ConflictError(`Submission is ${current} and can no longer be changed`);
  }
  return TARGET_STATE[event];
};
