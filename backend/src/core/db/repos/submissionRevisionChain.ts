import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { Tx } from '../client';
import { RevisionReason, RevisionStatus, SubmissionEventType } from '../codes';
import { submissionRevisions } from '../schema';

/** Append order over all revisions; the current version's number lives in current_revision_no. */
export const nextRevisionNo = async (
  tx: Tx,
  workspaceId: string,
  submissionId: string,
): Promise<number> => {
  const [{ next }] = await tx
    .select({
      next: sql<number>`coalesce(max(${submissionRevisions.revisionNo}), -1) + 1`,
    })
    .from(submissionRevisions)
    .where(
      and(
        eq(submissionRevisions.submissionId, submissionId),
        eq(submissionRevisions.workspaceId, workspaceId),
      ),
    );
  return Number(next);
};

/** The outgoing head is the single current revision; demote it before the new head commits. */
export const demoteHead = async (
  tx: Tx,
  workspaceId: string,
  headRevisionId: string | null,
): Promise<void> => {
  if (!headRevisionId) return;
  await tx
    .update(submissionRevisions)
    .set({ status: RevisionStatus.superseded, reason: RevisionReason.replaced })
    .where(
      and(
        eq(submissionRevisions.id, headRevisionId),
        eq(submissionRevisions.workspaceId, workspaceId),
      ),
    );
};

/** The head a restore leaves: the revision now current, its number and its answer document. */
export interface RestoredHead {
  headRevisionId: string;
  currentRevisionNo: number;
  engineSubmissionRef: string | null;
}

/**
 * Make the last submitted answers current again, inside the caller's transaction, which holds the
 * submission's row lock. Answer documents are never changed, so the restore is a new current
 * revision pointing at the last submit's document. Null when the head already is the last submit,
 * or nothing was ever submitted.
 */
export const restoreLastSubmitted = async (
  tx: Tx,
  input: {
    workspaceId: string;
    submissionId: string;
    headRevisionId: string | null;
    engineSubmissionRef: string | null;
    actorId: string;
  },
): Promise<RestoredHead | null> => {
  const [lastSubmit] = await tx
    .select({
      id: submissionRevisions.id,
      afterEngineSubmissionRef: submissionRevisions.afterEngineSubmissionRef,
    })
    .from(submissionRevisions)
    .where(
      and(
        eq(submissionRevisions.workspaceId, input.workspaceId),
        eq(submissionRevisions.submissionId, input.submissionId),
        eq(submissionRevisions.eventType, SubmissionEventType.submitted),
        ne(submissionRevisions.status, RevisionStatus.pending),
      ),
    )
    .orderBy(desc(submissionRevisions.revisionNo))
    .limit(1);
  if (!lastSubmit || lastSubmit.id === input.headRevisionId) return null;

  const revisionNo = await nextRevisionNo(tx, input.workspaceId, input.submissionId);
  await demoteHead(tx, input.workspaceId, input.headRevisionId);
  const [restored] = await tx
    .insert(submissionRevisions)
    .values({
      workspaceId: input.workspaceId,
      submissionId: input.submissionId,
      revisionNo,
      parentRevisionId: input.headRevisionId,
      eventType: SubmissionEventType.restored,
      status: RevisionStatus.current,
      reason: RevisionReason.accepted,
      beforeEngineSubmissionRef: input.engineSubmissionRef,
      afterEngineSubmissionRef: lastSubmit.afterEngineSubmissionRef,
      changedBy: input.actorId,
    })
    .returning({ id: submissionRevisions.id });
  return {
    headRevisionId: restored.id,
    currentRevisionNo: revisionNo,
    engineSubmissionRef: lastSubmit.afterEngineSubmissionRef,
  };
};
