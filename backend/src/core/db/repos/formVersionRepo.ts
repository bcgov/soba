import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { db, type DbOrTx } from '../client';
import { formVersionRevisions, formVersions } from '../schema';

interface CreateDraftInput {
  workspaceId: string;
  formId: string;
  actorId: string;
}

interface SaveRevisionInput {
  workspaceId: string;
  formVersionId: string;
  actorId: string;
  eventType: string;
  changeNote?: string;
}

export type FormVersionListSort = 'id:desc' | 'updatedAt:desc';
export type FormVersionCursorMode = 'id' | 'ts_id';

export interface ListFormVersionsInput {
  workspaceId: string;
  limit: number;
  formId?: string;
  state?: string;
  sort: FormVersionListSort;
  cursorMode: FormVersionCursorMode;
  afterId?: string;
  afterUpdatedAt?: Date;
}

export interface FormVersionListRow {
  id: string;
  formId: string;
  versionNo: number;
  state: string;
  engineSyncStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export const createEmptyFormVersionDraft = async (input: CreateDraftInput, tx?: DbOrTx) => {
  const run = async (d: DbOrTx) => {
    const latest = await d
      .select({ versionNo: formVersions.versionNo })
      .from(formVersions)
      .where(
        and(eq(formVersions.workspaceId, input.workspaceId), eq(formVersions.formId, input.formId)),
      )
      .orderBy(desc(formVersions.versionNo))
      .limit(1);

    const nextVersion = (latest[0]?.versionNo ?? 0) + 1;

    const created = await d
      .insert(formVersions)
      .values({
        workspaceId: input.workspaceId,
        formId: input.formId,
        versionNo: nextVersion,
        state: 'draft',
        engineSyncStatus: 'pending',
        currentRevisionNo: 0,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .returning();

    return created[0];
  };

  if (tx) {
    return run(tx);
  }
  return db.transaction(run);
};

export const getFormVersionById = async (workspaceId: string, formVersionId: string) => {
  const row = await db
    .select()
    .from(formVersions)
    .where(
      and(
        eq(formVersions.workspaceId, workspaceId),
        eq(formVersions.id, formVersionId),
        isNull(formVersions.deletedAt),
      ),
    )
    .limit(1);

  return row[0] ?? null;
};

export const listFormVersionsForWorkspace = async (
  input: ListFormVersionsInput,
): Promise<{ items: FormVersionListRow[]; hasMore: boolean }> => {
  const whereClauses = [
    eq(formVersions.workspaceId, input.workspaceId),
    isNull(formVersions.deletedAt),
  ];

  if (input.formId) {
    whereClauses.push(eq(formVersions.formId, input.formId));
  }

  if (input.state) {
    whereClauses.push(eq(formVersions.state, input.state));
  }

  if (input.cursorMode === 'id' && input.afterId) {
    whereClauses.push(lt(formVersions.id, input.afterId));
  }

  if (input.cursorMode === 'ts_id' && input.afterId && input.afterUpdatedAt) {
    whereClauses.push(
      or(
        lt(formVersions.updatedAt, input.afterUpdatedAt),
        and(eq(formVersions.updatedAt, input.afterUpdatedAt), lt(formVersions.id, input.afterId)),
      ),
    );
  }

  const rows = await db
    .select({
      id: formVersions.id,
      formId: formVersions.formId,
      versionNo: formVersions.versionNo,
      state: formVersions.state,
      engineSyncStatus: formVersions.engineSyncStatus,
      createdAt: formVersions.createdAt,
      updatedAt: formVersions.updatedAt,
    })
    .from(formVersions)
    .where(and(...whereClauses))
    .orderBy(
      input.cursorMode === 'ts_id' || input.sort === 'updatedAt:desc'
        ? desc(formVersions.updatedAt)
        : desc(formVersions.id),
      desc(formVersions.id),
    )
    .limit(input.limit + 1);

  return {
    items: rows.slice(0, input.limit),
    hasMore: rows.length > input.limit,
  };
};

export const updateFormVersionDraft = async (
  workspaceId: string,
  formVersionId: string,
  actorId: string,
  patch: Partial<{
    state: string;
    engineSchemaRef: string;
    engineSyncStatus: string;
    engineSyncError: string;
  }>,
  tx?: DbOrTx,
) => {
  const d = tx ?? db;
  const updated = await d
    .update(formVersions)
    .set({
      ...patch,
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(and(eq(formVersions.id, formVersionId), eq(formVersions.workspaceId, workspaceId)))
    .returning();

  return updated[0] ?? null;
};

export const appendFormVersionRevision = async (input: SaveRevisionInput, tx?: DbOrTx) => {
  const d = tx ?? db;
  const current = await d
    .select()
    .from(formVersions)
    .where(
      and(
        eq(formVersions.id, input.formVersionId),
        eq(formVersions.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);

  const version = current[0];
  if (!version) return null;

  const nextRevision = version.currentRevisionNo + 1;

  await d.insert(formVersionRevisions).values({
    workspaceId: input.workspaceId,
    formVersionId: input.formVersionId,
    revisionNo: nextRevision,
    eventType: input.eventType,
    beforeEngineSchemaRef: version.engineSchemaRef,
    afterEngineSchemaRef: version.engineSchemaRef,
    changedBy: input.actorId,
    changeNote: input.changeNote,
  });

  const updated = await d
    .update(formVersions)
    .set({
      currentRevisionNo: nextRevision,
      updatedBy: input.actorId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(formVersions.id, input.formVersionId),
        eq(formVersions.workspaceId, input.workspaceId),
      ),
    )
    .returning();

  return updated[0] ?? null;
};

export const markFormVersionDeleted = async (
  workspaceId: string,
  formVersionId: string,
  actorId: string,
) => {
  const updated = await db
    .update(formVersions)
    .set({
      state: 'deleted',
      deletedAt: new Date(),
      deletedBy: actorId,
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(and(eq(formVersions.id, formVersionId), eq(formVersions.workspaceId, workspaceId)))
    .returning();

  return updated[0] ?? null;
};
