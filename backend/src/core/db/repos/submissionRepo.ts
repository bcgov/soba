import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { db } from '../client';
import { submissionRevisions, submissions, forms, formVersions } from '../schema';

export type SubmissionRecord = typeof submissions.$inferSelect;

export interface SubmissionListRow {
  id: string;
  formId: string;
  form: { name: string | null };
  formVersionId: string;
  formVersion: { versionNo: number | null };
  workflowState: string;
  engineSyncStatus: string;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionDetailRow extends SubmissionListRow {
  currentRevisionNo: number;
}

interface CreateSubmissionInput {
  workspaceId: string;
  formId: string;
  formVersionId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  workflowState?: string;
}

interface SaveSubmissionInput {
  workspaceId: string;
  submissionId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  eventType: string;
  changeNote?: string;
  /** Engine ref of the newly-created submission document for this revision (the "after" ref). */
  afterEngineSubmissionRef: string;
}

export type SubmissionListSort = 'id:desc' | 'updatedAt:desc';
export type SubmissionCursorMode = 'id' | 'ts_id';

export interface ListSubmissionsInput {
  workspaceId: string;
  limit: number;
  formId?: string;
  formVersionId?: string;
  workflowState?: string;
  createdBy?: string;
  sort: SubmissionListSort;
  cursorMode: SubmissionCursorMode;
  afterId?: string;
  afterUpdatedAt?: Date;
}

export const createEmptySubmission = async (input: CreateSubmissionInput) => {
  const created = await db
    .insert(submissions)
    .values({
      workspaceId: input.workspaceId,
      formId: input.formId,
      formVersionId: input.formVersionId,
      workflowState: input.workflowState || 'draft',
      engineSyncStatus: 'pending',
      currentRevisionNo: 0,
      createdBy: input.actorDisplayLabel,
      updatedBy: input.actorDisplayLabel,
    })
    .returning();

  return created[0];
};

/** Fetch the raw (non-deleted) submission row — used by the engine write path. */
export const getSubmissionRecordById = async (
  workspaceId: string,
  submissionId: string,
): Promise<SubmissionRecord | null> => {
  const rows = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.workspaceId, workspaceId),
        eq(submissions.id, submissionId),
        isNull(submissions.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
};

export const getSubmissionById = async (
  workspaceId: string,
  submissionId: string,
): Promise<SubmissionDetailRow | null> => {
  const row = await db
    .select({
      id: submissions.id,
      formId: submissions.formId,
      form: { name: forms.name },
      formVersionId: submissions.formVersionId,
      formVersion: { versionNo: formVersions.versionNo },
      workflowState: submissions.workflowState,
      engineSyncStatus: submissions.engineSyncStatus,
      currentRevisionNo: submissions.currentRevisionNo,
      submittedAt: submissions.submittedAt,
      createdAt: submissions.createdAt,
      updatedAt: submissions.updatedAt,
    })
    .from(submissions)
    .leftJoin(forms, eq(submissions.formId, forms.id))
    .leftJoin(formVersions, eq(submissions.formVersionId, formVersions.id))
    .where(
      and(
        eq(submissions.workspaceId, workspaceId),
        eq(submissions.id, submissionId),
        isNull(submissions.deletedAt),
      ),
    )
    .limit(1);

  return row[0] ?? null;
};

export const listSubmissionsForWorkspace = async (
  input: ListSubmissionsInput,
): Promise<{ items: SubmissionListRow[]; hasMore: boolean }> => {
  const whereClauses = [
    eq(submissions.workspaceId, input.workspaceId),
    isNull(submissions.deletedAt),
  ];

  if (input.formId) {
    whereClauses.push(eq(submissions.formId, input.formId));
  }

  if (input.formVersionId) {
    whereClauses.push(eq(submissions.formVersionId, input.formVersionId));
  }

  if (input.workflowState) {
    whereClauses.push(eq(submissions.workflowState, input.workflowState));
  }

  if (input.createdBy) {
    whereClauses.push(eq(submissions.createdBy, input.createdBy));
  }

  if (input.cursorMode === 'id' && input.afterId) {
    whereClauses.push(lt(submissions.id, input.afterId));
  }

  if (input.cursorMode === 'ts_id' && input.afterId && input.afterUpdatedAt) {
    whereClauses.push(
      or(
        lt(submissions.updatedAt, input.afterUpdatedAt),
        and(eq(submissions.updatedAt, input.afterUpdatedAt), lt(submissions.id, input.afterId)),
      ),
    );
  }

  const rows = await db
    .select({
      id: submissions.id,
      formId: submissions.formId,
      form: { name: forms.name },
      formVersionId: submissions.formVersionId,
      formVersion: { versionNo: formVersions.versionNo },
      workflowState: submissions.workflowState,
      engineSyncStatus: submissions.engineSyncStatus,
      submittedAt: submissions.submittedAt,
      createdAt: submissions.createdAt,
      updatedAt: submissions.updatedAt,
    })
    .from(submissions)
    .innerJoin(forms, eq(submissions.formId, forms.id))
    .innerJoin(formVersions, eq(submissions.formVersionId, formVersions.id))
    .where(and(...whereClauses))
    .orderBy(
      input.cursorMode === 'ts_id' || input.sort === 'updatedAt:desc'
        ? desc(submissions.updatedAt)
        : desc(submissions.id),
      desc(submissions.id),
    )
    .limit(input.limit + 1);

  return {
    items: rows.slice(0, input.limit),
    hasMore: rows.length > input.limit,
  };
};

export const updateSubmissionDraft = async (
  workspaceId: string,
  submissionId: string,
  actorDisplayLabel: string | null,
  patch: Partial<{
    workflowState: string;
    engineSubmissionRef: string;
    engineSyncStatus: string;
    engineSyncError: string | null;
    submittedBy: string;
    submittedAt: Date;
  }>,
) => {
  const updated = await db
    .update(submissions)
    .set({
      ...patch,
      updatedBy: actorDisplayLabel,
      updatedAt: new Date(),
    })
    .where(and(eq(submissions.id, submissionId), eq(submissions.workspaceId, workspaceId)))
    .returning();

  return updated[0] ?? null;
};

/**
 * Record a submission revision and advance the submission's current pointer in one transaction.
 * `beforeEngineSubmissionRef` is the submission's current ref; `afterEngineSubmissionRef` is the
 * newly-created engine document for this save — so the revision captures the real change. Marks the
 * submission `ready` (the engine write already succeeded) and stamps submit events.
 */
export const appendSubmissionRevision = async (input: SaveSubmissionInput) => {
  return db.transaction(async (tx) => {
    const current = await tx
      .select()
      .from(submissions)
      .where(
        and(eq(submissions.id, input.submissionId), eq(submissions.workspaceId, input.workspaceId)),
      )
      .limit(1);

    const submission = current[0];
    if (!submission) return null;

    const nextRevision = submission.currentRevisionNo + 1;

    await tx.insert(submissionRevisions).values({
      workspaceId: input.workspaceId,
      submissionId: input.submissionId,
      revisionNo: nextRevision,
      eventType: input.eventType,
      beforeEngineSubmissionRef: submission.engineSubmissionRef,
      afterEngineSubmissionRef: input.afterEngineSubmissionRef,
      changedBy: input.actorId,
      changeNote: input.changeNote,
    });

    const updates: Record<string, unknown> = {
      currentRevisionNo: nextRevision,
      engineSubmissionRef: input.afterEngineSubmissionRef,
      engineSyncStatus: 'ready',
      engineSyncError: null,
      updatedBy: input.actorDisplayLabel,
      updatedAt: new Date(),
    };

    if (input.eventType === 'submit' && !submission.submittedBy) {
      updates.submittedBy = input.actorId;
      updates.submittedAt = new Date();
      updates.workflowState = 'submitted';
    }

    const updated = await tx
      .update(submissions)
      .set(updates)
      .where(
        and(eq(submissions.id, input.submissionId), eq(submissions.workspaceId, input.workspaceId)),
      )
      .returning();

    return updated[0] ?? null;
  });
};

export const markSubmissionDeleted = async (
  workspaceId: string,
  submissionId: string,
  actorDisplayLabel: string | null,
) => {
  const updated = await db
    .update(submissions)
    .set({
      workflowState: 'deleted',
      deletedAt: new Date(),
      deletedBy: actorDisplayLabel,
      updatedBy: actorDisplayLabel,
      updatedAt: new Date(),
    })
    .where(and(eq(submissions.id, submissionId), eq(submissions.workspaceId, workspaceId)))
    .returning();

  return updated[0] ?? null;
};
