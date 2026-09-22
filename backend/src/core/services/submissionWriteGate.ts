import type { SubmissionEventTypeCode, SubmissionWorkflowStateCode } from '../db/codes';
import { ConflictError } from '../errors';
import { resolveSubmissionTransition } from './submissionLifecycle';

export const STALE_WRITE = 'Submission changed since it was loaded';

export interface SubmissionWriteRequest {
  submission: { id: string; workflowState: string; headRevisionId: string | null };
  eventType: SubmissionEventTypeCode;
  /** Head the client loaded; the current head is assumed when absent. */
  baseRevisionId?: string;
  /** The revision already recorded under the request's revision id, if any. */
  recorded: { submissionId: string; eventType: string } | null;
}

export type SubmissionWriteDecision =
  | { kind: 'replay' }
  | {
      kind: 'write';
      workflowState: SubmissionWorkflowStateCode;
      parentRevisionId: string | null;
    };

/**
 * Decide a save/submit before any write. A recorded revision id is a replay, checked ahead of the
 * lifecycle so a retried submit that already succeeded is not a 409. Throws ConflictError when the
 * revision id belongs to another write, the submission is terminal, or the base is not the head.
 */
export const decideSubmissionWrite = (request: SubmissionWriteRequest): SubmissionWriteDecision => {
  const { submission, eventType, recorded } = request;
  if (recorded) {
    if (recorded.submissionId !== submission.id || recorded.eventType !== eventType) {
      throw new ConflictError('Revision id already used by another write');
    }
    return { kind: 'replay' };
  }

  const workflowState = resolveSubmissionTransition(submission.workflowState, eventType);

  const parentRevisionId = request.baseRevisionId ?? submission.headRevisionId;
  if (parentRevisionId !== submission.headRevisionId) throw new ConflictError(STALE_WRITE);

  return { kind: 'write', workflowState, parentRevisionId };
};
