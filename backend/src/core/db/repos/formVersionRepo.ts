import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DEFAULT_SORT_LOCALE, FORM_VERSION_SORT_FIELDS, type SortToken } from '@soba/lib';
import { db, type DbOrTx } from '../client';
import { formVersionRevisions, formVersions } from '../schema';
import { orderByForSort, prefixPattern, type SortColumns } from '../listSort';
import { readListPage } from '../listRead';

interface CreateDraftInput {
  workspaceId: string;
  formId: string;
  actorId: string;
  actorDisplayLabel: string | null;
}

interface SaveRevisionInput {
  workspaceId: string;
  formVersionId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  eventType: string;
  changeNote?: string;
  engineSchemaRef?: string | null;
}

export type FormVersionListSortField = (typeof FORM_VERSION_SORT_FIELDS)[number];
export type FormVersionListSort = SortToken<FormVersionListSortField>;

const FORM_VERSION_SORT_COLUMNS: SortColumns<FormVersionListSortField> = {
  versionNo: { column: formVersions.versionNo },
  state: { column: formVersions.state },
  createdAt: { column: formVersions.createdAt },
  updatedAt: { column: formVersions.updatedAt },
};

export interface ListFormVersionsInput {
  /** Workspace resolved from the list scope anchor. */
  workspaceIds: string[];
  offset: number;
  limit: number;
  formId?: string;
  formVersionId?: string;
  state?: string;
  sort: FormVersionListSort;
}

export interface FormVersionListRow {
  id: string;
  formId: string;
  versionNo: number;
  state: string;
  engineSyncStatus: string;
  engineSchemaRef: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Resolve list-scope context for a form version by id alone. Returns null for missing/deleted versions.
 */
export const getFormVersionListContext = async (
  formVersionId: string,
): Promise<{ workspaceId: string; formId: string } | null> => {
  const row = await db
    .select({ workspaceId: formVersions.workspaceId, formId: formVersions.formId })
    .from(formVersions)
    .where(and(eq(formVersions.id, formVersionId), isNull(formVersions.deletedAt)))
    .limit(1);

  return row[0] ?? null;
};

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
        createdBy: input.actorDisplayLabel,
        updatedBy: input.actorDisplayLabel,
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
): Promise<{ items: FormVersionListRow[]; total: number }> => {
  // An empty scope means the actor holds the permission in no workspace, never "all workspaces".
  if (input.workspaceIds.length === 0) {
    return { items: [], total: 0 };
  }
  const whereClauses = [
    inArray(formVersions.workspaceId, input.workspaceIds),
    isNull(formVersions.deletedAt),
  ];

  if (input.formId) {
    whereClauses.push(eq(formVersions.formId, input.formId));
  }

  if (input.formVersionId) {
    whereClauses.push(eq(formVersions.id, input.formVersionId));
  }

  if (input.state) {
    whereClauses.push(eq(formVersions.state, input.state));
  }

  const where = and(...whereClauses);

  return readListPage(async (tx) => {
    const items = await tx
      .select({
        id: formVersions.id,
        formId: formVersions.formId,
        versionNo: formVersions.versionNo,
        state: formVersions.state,
        engineSyncStatus: formVersions.engineSyncStatus,
        engineSchemaRef: formVersions.engineSchemaRef,
        createdAt: formVersions.createdAt,
        updatedAt: formVersions.updatedAt,
        createdBy: formVersions.createdBy,
        updatedBy: formVersions.updatedBy,
      })
      .from(formVersions)
      .where(where)
      .orderBy(
        ...orderByForSort(
          FORM_VERSION_SORT_COLUMNS,
          input.sort,
          formVersions.id,
          DEFAULT_SORT_LOCALE,
        ),
      )
      .limit(input.limit)
      .offset(input.offset);
    const totals = await tx.select({ total: count() }).from(formVersions).where(where);
    return { items, total: totals[0]?.total ?? 0 };
  });
};

export interface FormVersionSummaryRow {
  id: string;
  versionNo: number;
  state: string;
}

const summaryColumns = {
  id: formVersions.id,
  versionNo: formVersions.versionNo,
  state: formVersions.state,
};

export interface LookupFormVersionsInput {
  /** Workspace resolved from the list scope anchor. */
  workspaceIds: string[];
  formId: string;
  q?: string;
  limit: number;
}

/** One form's versions, newest first. `q` matches the start of the version number. */
export const lookupFormVersions = async (
  input: LookupFormVersionsInput,
): Promise<FormVersionSummaryRow[]> => {
  // An empty scope means the actor holds the permission in no workspace, never "all workspaces".
  if (input.workspaceIds.length === 0) {
    return [];
  }
  const whereClauses = [
    inArray(formVersions.workspaceId, input.workspaceIds),
    eq(formVersions.formId, input.formId),
    isNull(formVersions.deletedAt),
  ];
  if (input.q) {
    whereClauses.push(sql`${formVersions.versionNo}::text like ${prefixPattern(input.q)}`);
  }
  return db
    .select(summaryColumns)
    .from(formVersions)
    .where(and(...whereClauses))
    .orderBy(desc(formVersions.versionNo))
    .limit(input.limit);
};

/** The version save and publish target: the highest-numbered one that is not deleted. */
export const getCurrentFormVersion = async (
  workspaceId: string,
  formId: string,
  tx?: DbOrTx,
): Promise<FormVersionSummaryRow | null> => {
  const d = tx ?? db;
  const row = await d
    .select(summaryColumns)
    .from(formVersions)
    .where(
      and(
        eq(formVersions.workspaceId, workspaceId),
        eq(formVersions.formId, formId),
        isNull(formVersions.deletedAt),
      ),
    )
    .orderBy(desc(formVersions.versionNo))
    .limit(1);

  return row[0] ?? null;
};

/**
 * Holds the version row until the transaction ends. Writes to that row wait; a newer version can
 * still be inserted.
 */
export const lockFormVersion = async (workspaceId: string, formVersionId: string, tx: DbOrTx) => {
  const row = await tx
    .select()
    .from(formVersions)
    .where(
      and(
        eq(formVersions.workspaceId, workspaceId),
        eq(formVersions.id, formVersionId),
        isNull(formVersions.deletedAt),
      ),
    )
    .limit(1)
    .for('no key update');

  return row[0] ?? null;
};

export const updateFormVersionDraft = async (
  workspaceId: string,
  formVersionId: string,
  actorDisplayLabel: string | null,
  patch: Partial<{
    state: string;
    engineSchemaRef: string;
    engineSyncStatus: string;
    engineSyncError: string | null;
    publishedAt: Date | null;
    publishedBy: string | null;
    deletedAt: Date | null;
    deletedBy: string | null;
  }>,
  tx?: DbOrTx,
) => {
  const d = tx ?? db;
  const updated = await d
    .update(formVersions)
    .set({
      ...patch,
      updatedBy: actorDisplayLabel,
      updatedAt: new Date(),
    })
    .where(and(eq(formVersions.id, formVersionId), eq(formVersions.workspaceId, workspaceId)))
    .returning();

  return updated[0] ?? null;
};

/**
 * Records the outcome of a provision that claimed the version at `claimedAt`. Returns null and
 * changes nothing when another provision has claimed it since, or it is no longer a live draft.
 */
export const finishFormVersionProvisioning = async (
  workspaceId: string,
  formVersionId: string,
  actorDisplayLabel: string | null,
  claimedAt: Date,
  patch: Partial<{
    engineSchemaRef: string;
    engineSyncStatus: string;
    engineSyncError: string | null;
  }>,
) => {
  const updated = await db
    .update(formVersions)
    .set({ ...patch, updatedBy: actorDisplayLabel, updatedAt: new Date() })
    .where(
      and(
        eq(formVersions.id, formVersionId),
        eq(formVersions.workspaceId, workspaceId),
        eq(formVersions.updatedAt, claimedAt),
        eq(formVersions.state, 'draft'),
        isNull(formVersions.deletedAt),
      ),
    )
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
    beforeEngineSchemaRef: input.engineSchemaRef ? input.engineSchemaRef : version.engineSchemaRef,
    afterEngineSchemaRef: input.engineSchemaRef ? input.engineSchemaRef : version.engineSchemaRef,
    changedBy: input.actorId,
    changeNote: input.changeNote,
  });

  const updated = await d
    .update(formVersions)
    .set({
      currentRevisionNo: nextRevision,
      ...(input.engineSchemaRef ? { engineSchemaRef: input.engineSchemaRef } : {}),
      updatedBy: input.actorDisplayLabel,
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

/** Loads a form version by id including soft-deleted rows (for restore/delete guards). */
export const getFormVersionByIdIncludingDeleted = async (
  workspaceId: string,
  formVersionId: string,
) => {
  const row = await db
    .select()
    .from(formVersions)
    .where(and(eq(formVersions.workspaceId, workspaceId), eq(formVersions.id, formVersionId)))
    .limit(1);

  return row[0] ?? null;
};

/** The form's currently-published version (if any), used by publish to demote the incumbent. */
export const getPublishedVersionForForm = async (
  workspaceId: string,
  formId: string,
  tx?: DbOrTx,
) => {
  const d = tx ?? db;
  const row = await d
    .select()
    .from(formVersions)
    .where(
      and(
        eq(formVersions.workspaceId, workspaceId),
        eq(formVersions.formId, formId),
        eq(formVersions.state, 'published'),
        isNull(formVersions.deletedAt),
      ),
    )
    .limit(1);

  return row[0] ?? null;
};
