import {
  RevisionReason,
  RevisionStatus,
  type RevisionReasonCode,
  type RevisionStatusCode,
  type SubmissionWriteEventCode,
  type SubmissionWorkflowStateCode,
} from '../db/codes';
import { ConflictError } from '../errors';
import { isTerminalSubmissionState, resolveSubmissionTransition } from './submissionLifecycle';

/** A revision already recorded under a write's revision id. */
export interface RecordedRevision {
  submissionId: string;
  eventType: string;
  changedBy: string | null;
  revisionNo: number;
  status: string;
  reason: string;
}

/** Where a write landed: `current` applied it, `pending` held it for review. */
export interface WriteLanding {
  id: string;
  revisionNo: number;
  status: RevisionStatusCode;
  reason: RevisionReasonCode;
}

export type RecordedWriteDecision = { kind: 'new' } | { kind: 'replay'; revision: WriteLanding };

/**
 * Whether a save/submit was already recorded under its revision id. The caller's own write of the
 * same event on the same submission replays where it first landed: a revision that landed as current
 * and was later superseded still replays as `current`. Any other write under the id is a
 * ConflictError.
 */
export const decideRecordedWrite = (request: {
  submissionId: string;
  eventType: SubmissionWriteEventCode;
  actorId: string;
  revisionId: string;
  recorded: RecordedRevision | null;
}): RecordedWriteDecision => {
  const { recorded } = request;
  if (!recorded) return { kind: 'new' };
  if (
    recorded.submissionId !== request.submissionId ||
    recorded.eventType !== request.eventType ||
    recorded.changedBy !== request.actorId
  ) {
    throw new ConflictError('Revision id already used by another write');
  }
  const landedPending = recorded.status === RevisionStatus.pending;
  return {
    kind: 'replay',
    revision: {
      id: request.revisionId,
      revisionNo: recorded.revisionNo,
      status: landedPending ? RevisionStatus.pending : RevisionStatus.current,
      reason: landedPending ? (recorded.reason as RevisionReasonCode) : RevisionReason.accepted,
    },
  };
};

export interface SubmissionWriteRequest {
  submission: { id: string; workflowState: string; headRevisionId: string | null };
  eventType: SubmissionWriteEventCode;
  /** Head the client loaded. */
  baseRevisionId: string;
}

export type SubmissionWriteDecision =
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
 * Decide a new save/submit before any write. A write against a submitted submission, or one whose
 * base is no longer the head, is kept as a pending revision rather than rejected: the current
 * version and workflow state stay put and staff resolve it later.
 */
export const decideSubmissionWrite = (request: SubmissionWriteRequest): SubmissionWriteDecision => {
  const { submission, eventType, baseRevisionId: base } = request;

  if (isTerminalSubmissionState(submission.workflowState)) {
    return { kind: 'pending', reason: RevisionReason.closed, parentRevisionId: base };
  }

  if (base !== submission.headRevisionId) {
    return { kind: 'pending', reason: RevisionReason.conflict, parentRevisionId: base };
  }

  const workflowState = resolveSubmissionTransition(submission.workflowState, eventType);
  return { kind: 'current', workflowState, parentRevisionId: submission.headRevisionId };
};
