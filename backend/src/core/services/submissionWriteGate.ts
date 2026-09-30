import {
  RevisionReason,
  type RevisionReasonCode,
  type SubmissionWriteEventCode,
  type SubmissionWorkflowStateCode,
} from '../db/codes';
import { ConflictError } from '../errors';
import { isTerminalSubmissionState, resolveSubmissionTransition } from './submissionLifecycle';

export interface SubmissionWriteRequest {
  submission: { id: string; workflowState: string; headRevisionId: string | null };
  eventType: SubmissionWriteEventCode;
  /** Head the client loaded; the current head is assumed when absent. */
  baseRevisionId?: string;
  /** The revision already recorded under the request's revision id, if any. */
  recorded: { submissionId: string; eventType: string } | null;
}

export type SubmissionWriteDecision =
  | { kind: 'replay' }
  | {
      kind: 'current';
      workflowState: SubmissionWorkflowStateCode;
      parentRevisionId: string | null;
    }
  | {
      kind: 'pending';
      reason: RevisionReasonCode;
      parentRevisionId: string | null;
    };

/**
 * Decide a save/submit before any write. A recorded revision id is a replay, checked ahead of
 * everything so a retried write that already landed is not repeated. A write against a submitted
 * submission, or one whose base is no longer the head, is kept as a pending revision rather than
 * rejected: the current version and workflow state stay put and staff resolve it later. Only a
 * revision id already bound to a different write is a hard ConflictError.
 */
export const decideSubmissionWrite = (request: SubmissionWriteRequest): SubmissionWriteDecision => {
  const { submission, eventType, recorded } = request;
  if (recorded) {
    if (recorded.submissionId !== submission.id || recorded.eventType !== eventType) {
      throw new ConflictError('Revision id already used by another write');
    }
    return { kind: 'replay' };
  }

  const base = request.baseRevisionId ?? submission.headRevisionId;

  if (isTerminalSubmissionState(submission.workflowState)) {
    return { kind: 'pending', reason: RevisionReason.closed, parentRevisionId: base };
  }

  if (base !== submission.headRevisionId) {
    return { kind: 'pending', reason: RevisionReason.conflict, parentRevisionId: base };
  }

  const workflowState = resolveSubmissionTransition(submission.workflowState, eventType);
  return { kind: 'current', workflowState, parentRevisionId: submission.headRevisionId };
};
