import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { db } from '../client';
import { submissionRevisions, submissions } from '../schema';

interface CreateSubmissionInput {
  workspaceId: string;
  formId: string;
  formVersionId: string;
  actorId: string;
}

interface SaveSubmissionInput {
  workspaceId: string;
  submissionId: string;
  actorId: string;
  eventType: string;
  changeNote?: string;
}

export type SubmissionListSort = 'id:desc' | 'updatedAt:desc';
export type SubmissionCursorMode = 'id' | 'ts_id';

export interface ListSubmissionsInput {
  workspaceId: string;
  limit: number;
  formId?: string;
  formVersionId?: string;
  workflowState?: string;
  sort: SubmissionListSort;
  cursorMode: SubmissionCursorMode;
  afterId?: string;
  afterUpdatedAt?: Date;
}

export interface SubmissionListRow {
  id: string;
  formId: string;
  formVersionId: string;
  workflowState: string;
  engineSyncStatus: string;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const createEmptySubmission = async (input: CreateSubmissionInput) => {
  const created = await db
    .insert(submissions)
    .values({
      workspaceId: input.workspaceId,
      formId: input.formId,
      formVersionId: input.formVersionId,
      workflowState: 'draft',
      engineSyncStatus: 'pending',
      currentRevisionNo: 0,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    })
    .returning();

  return created[0];
};

export const getSubmissionById = async (workspaceId: string, submissionId: string) => {
  const row = await db
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
      formVersionId: submissions.formVersionId,
      workflowState: submissions.workflowState,
      engineSyncStatus: submissions.engineSyncStatus,
      submittedAt: submissions.submittedAt,
      createdAt: submissions.createdAt,
      updatedAt: submissions.updatedAt,
    })
    .from(submissions)
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
  actorId: string,
  patch: Partial<{
    workflowState: string;
    engineSubmissionRef: string;
    engineSyncStatus: string;
    engineSyncError: string;
    submittedBy: string;
    submittedAt: Date;
  }>,
) => {
  const updated = await db
    .update(submissions)
    .set({
      ...patch,
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(and(eq(submissions.id, submissionId), eq(submissions.workspaceId, workspaceId)))
    .returning();

  return updated[0] ?? null;
};

export const appendSubmissionRevision = async (input: SaveSubmissionInput) => {
  const current = await db
    .select()
    .from(submissions)
    .where(
      and(eq(submissions.id, input.submissionId), eq(submissions.workspaceId, input.workspaceId)),
    )
    .limit(1);

  const submission = current[0];
  if (!submission) return null;

  const nextRevision = submission.currentRevisionNo + 1;

  await db.insert(submissionRevisions).values({
    workspaceId: input.workspaceId,
    submissionId: input.submissionId,
    revisionNo: nextRevision,
    eventType: input.eventType,
    beforeEngineSubmissionRef: submission.engineSubmissionRef,
    afterEngineSubmissionRef: submission.engineSubmissionRef,
    changedBy: input.actorId,
    changeNote: input.changeNote,
  });

  const updates: Record<string, unknown> = {
    currentRevisionNo: nextRevision,
    updatedBy: input.actorId,
    updatedAt: new Date(),
  };

  if (input.eventType === 'submit' && !submission.submittedBy) {
    updates.submittedBy = input.actorId;
    updates.submittedAt = new Date();
    updates.workflowState = 'submitted';
  }

  const updated = await db
    .update(submissions)
    .set(updates)
    .where(
      and(eq(submissions.id, input.submissionId), eq(submissions.workspaceId, input.workspaceId)),
    )
    .returning();

  return updated[0] ?? null;
};

export const markSubmissionDeleted = async (
  workspaceId: string,
  submissionId: string,
  actorId: string,
) => {
  const updated = await db
    .update(submissions)
    .set({
      workflowState: 'deleted',
      deletedAt: new Date(),
      deletedBy: actorId,
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(and(eq(submissions.id, submissionId), eq(submissions.workspaceId, workspaceId)))
    .returning();

  return updated[0] ?? null;
};
