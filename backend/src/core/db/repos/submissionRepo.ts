import { and, count, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { SUBMISSION_SORT_FIELDS, type SortLocale, type SubmissionListSort } from '@soba/lib';
import { db } from '../client';
import { submissionRevisions, submissions, forms, formVersions } from '../schema';
import { likePattern, orderByForSort, type SortColumns } from '../listSort';
import { readListPage } from '../listRead';
import {
  RevisionReason,
  RevisionStatus,
  SubmissionEventType,
  SubmissionWorkflowState,
  type RevisionReasonCode,
  type RevisionStatusCode,
  type SubmissionEventTypeCode,
  type SubmissionWorkflowStateCode,
} from '../codes';

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
  createdBy: string | null;
  submittedBy: string | null;
}

export interface SubmissionDetailRow extends SubmissionListRow {
  currentRevisionNo: number;
  headRevisionId: string | null;
}

interface CreateSubmissionInput {
  /** Client-minted uuidv7; the submission's primary key (no longer server-generated). */
  id: string;
  workspaceId: string;
  formId: string;
  formVersionId: string;
  actorId: string;
  actorDisplayLabel: string | null;
}

/**
 * created  — the id was free; a new opened submission (+ revision 0) was written.
 * existing — the id is already bound to this actor + form; the retry returns that row (idempotent).
 * conflict — the id is bound to a different actor or form (caller maps to 409).
 */
export type OpenSubmissionResult =
  | { outcome: 'created'; record: SubmissionRecord }
  | { outcome: 'existing'; record: SubmissionRecord }
  | { outcome: 'conflict' };

interface SaveSubmissionInput {
  workspaceId: string;
  submissionId: string;
  /** Minted before the engine write; the engine document is keyed on it. */
  revisionId: string;
  /** Head the write was based on; for a pending write, the branch point off the current chain. */
  parentRevisionId: string | null;
  actorId: string;
  actorDisplayLabel: string | null;
  eventType: SubmissionEventTypeCode;
  /**
   * The gate's intent. 'current' applies the revision as the new head; 'pending' holds it for review.
   * An intended-'current' write whose head moved since the gate read is downgraded to pending here.
   */
  status: Extract<RevisionStatusCode, 'current' | 'pending'>;
  /** Reason for a pending intent (conflict|closed); ignored when the write lands as current. */
  reason: RevisionReasonCode;
  /** Target workflow state, applied only when the write lands as current (see submissionLifecycle). */
  workflowState: SubmissionWorkflowStateCode;
  /** Engine ref of the newly-created submission document for this revision (the "after" ref). */
  afterEngineSubmissionRef: string;
}

/**
 * appended: the revision was recorded and is the new head.
 * pending: the revision was recorded off the current chain; head, state and current ref are unchanged.
 * replayed: this revision id was already recorded on the submission; nothing was written.
 * not_found: the submission is missing or soft-deleted.
 */
export type AppendSubmissionRevisionResult =
  | { outcome: 'not_found' }
  | {
      outcome: 'appended' | 'pending' | 'replayed';
      record: SubmissionRecord;
      revisionId: string;
      revisionNo: number;
      status: RevisionStatusCode;
      reason: RevisionReasonCode;
    };

export type SubmissionListSortField = (typeof SUBMISSION_SORT_FIELDS)[number];

const SUBMISSION_SORT_COLUMNS: SortColumns<SubmissionListSortField> = {
  formName: { column: forms.name, linguistic: true },
  // Only a submitted submission has one, so an unsubmitted row never leads either direction.
  submittedAt: { column: submissions.submittedAt, nullable: true },
  createdAt: { column: submissions.createdAt },
  updatedAt: { column: submissions.updatedAt },
};

export interface ListSubmissionsInput {
  /** Workspace resolved from the list scope anchor. */
  workspaceIds: string[];
  offset: number;
  limit: number;
  formId?: string;
  formVersionId?: string;
  submissionId?: string;
  workflowState?: string;
  createdBy?: string;
  q?: string;
  sort: SubmissionListSort;
  locale: SortLocale;
}

/**
 * Open a submission against a client-minted id: insert the row in the `opened` state and its
 * revision-0 `opened` event in one transaction, so every submission has a full history from the
 * moment a fill begins. `submittedBy` captures the actor who started it (the seeded public user for
 * anonymous fills).
 *
 * Idempotent on the id. `ON CONFLICT DO NOTHING` is the atomic gate: the row is only written when the
 * id is free, so concurrent double-opens are race-safe — the loser inserts nothing, falls through to
 * the select, and sees the winner's committed row. A taken id is a retry (same actor + form → return
 * the existing row) or a genuine collision (different owner → let the caller answer 409, not 500).
 */
export const openSubmission = async (
  input: CreateSubmissionInput,
): Promise<OpenSubmissionResult> => {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(submissions)
      .values({
        id: input.id,
        workspaceId: input.workspaceId,
        formId: input.formId,
        formVersionId: input.formVersionId,
        workflowState: SubmissionWorkflowState.opened,
        submittedBy: input.actorId,
        engineSyncStatus: 'pending',
        currentRevisionNo: 0,
        createdBy: input.actorDisplayLabel,
        updatedBy: input.actorDisplayLabel,
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      const revisionId = uuidv7();
      await tx.insert(submissionRevisions).values({
        id: revisionId,
        workspaceId: input.workspaceId,
        submissionId: created.id,
        revisionNo: 0,
        eventType: SubmissionEventType.opened,
        status: RevisionStatus.current,
        reason: RevisionReason.accepted,
        beforeEngineSubmissionRef: null,
        afterEngineSubmissionRef: null,
        changedBy: input.actorId,
      });
      const [record] = await tx
        .update(submissions)
        .set({ headRevisionId: revisionId })
        .where(eq(submissions.id, created.id))
        .returning();
      if (!record) throw new Error(`Submission ${created.id} missing after insert`);
      return { outcome: 'created', record };
    }

    // Only a live row is a valid idempotent retry; a soft-deleted tombstone on the same id is a
    // collision (409), not a resume — otherwise the caller gets a 200 to a submission that save/
    // submit/fill all 404 on (they filter deletedAt).
    const [existing] = await tx
      .select()
      .from(submissions)
      .where(and(eq(submissions.id, input.id), isNull(submissions.deletedAt)))
      .limit(1);

    if (existing?.submittedBy === input.actorId && existing?.formId === input.formId) {
      return { outcome: 'existing', record: existing };
    }
    return { outcome: 'conflict' };
  });
};

/** Look up a revision by id alone, to recognise a retried write and report its standing. */
export const getSubmissionRevisionById = async (
  revisionId: string,
): Promise<{
  submissionId: string;
  eventType: string;
  revisionNo: number;
  status: string;
  reason: string;
} | null> => {
  const rows = await db
    .select({
      submissionId: submissionRevisions.submissionId,
      eventType: submissionRevisions.eventType,
      revisionNo: submissionRevisions.revisionNo,
      status: submissionRevisions.status,
      reason: submissionRevisions.reason,
    })
    .from(submissionRevisions)
    .where(eq(submissionRevisions.id, revisionId))
    .limit(1);
  return rows[0] ?? null;
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
      headRevisionId: submissions.headRevisionId,
      submittedAt: submissions.submittedAt,
      createdAt: submissions.createdAt,
      updatedAt: submissions.updatedAt,
      createdBy: submissions.createdBy,
      submittedBy: submissions.submittedBy,
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

/**
 * Resolve list-scope context for a submission by id alone. Returns null for missing/deleted submissions.
 */
export const getSubmissionListContext = async (
  submissionId: string,
): Promise<{ workspaceId: string; formId: string; formVersionId: string } | null> => {
  const row = await db
    .select({
      workspaceId: submissions.workspaceId,
      formId: submissions.formId,
      formVersionId: submissions.formVersionId,
    })
    .from(submissions)
    .where(and(eq(submissions.id, submissionId), isNull(submissions.deletedAt)))
    .limit(1);

  return row[0] ?? null;
};

/** Resolve a submission's workspace, form, workflow state + owner by id alone (for the write gates). */
export const getSubmissionWorkspaceAndState = async (
  submissionId: string,
): Promise<{
  workspaceId: string;
  formId: string;
  workflowState: string;
  submittedBy: string | null;
} | null> => {
  const rows = await db
    .select({
      workspaceId: submissions.workspaceId,
      formId: submissions.formId,
      workflowState: submissions.workflowState,
      submittedBy: submissions.submittedBy,
    })
    .from(submissions)
    .where(and(eq(submissions.id, submissionId), isNull(submissions.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
};

export const listSubmissionsForWorkspace = async (
  input: ListSubmissionsInput,
): Promise<{ items: SubmissionListRow[]; total: number }> => {
  if (input.workspaceIds.length === 0) {
    return { items: [], total: 0 };
  }
  const whereClauses = [
    inArray(submissions.workspaceId, input.workspaceIds),
    isNull(submissions.deletedAt),
    // Workspace/staff list shows only real submissions; a just-`opened` shell isn't one yet.
    // (A future user-scoped list would surface the caller's own opened submissions.)
    ne(submissions.workflowState, SubmissionWorkflowState.opened),
  ];

  if (input.formId) {
    whereClauses.push(eq(submissions.formId, input.formId));
  }

  if (input.formVersionId) {
    whereClauses.push(eq(submissions.formVersionId, input.formVersionId));
  }

  if (input.submissionId) {
    whereClauses.push(eq(submissions.id, input.submissionId));
  }

  if (input.workflowState) {
    whereClauses.push(eq(submissions.workflowState, input.workflowState));
  }

  if (input.createdBy) {
    whereClauses.push(eq(submissions.createdBy, input.createdBy));
  }

  if (input.q) {
    const pattern = likePattern(input.q);
    whereClauses.push(
      or(ilike(forms.name, pattern), sql`${submissions.id}::text ilike ${pattern}`),
    );
  }

  const where = and(...whereClauses);

  return readListPage(async (tx) => {
    const items = await tx
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
        createdBy: submissions.createdBy,
        submittedBy: submissions.submittedBy,
      })
      .from(submissions)
      .innerJoin(forms, eq(submissions.formId, forms.id))
      .innerJoin(formVersions, eq(submissions.formVersionId, formVersions.id))
      .where(where)
      .orderBy(...orderByForSort(SUBMISSION_SORT_COLUMNS, input.sort, submissions.id, input.locale))
      .limit(input.limit)
      .offset(input.offset);

    // Both parent ids are not-null with validated foreign keys, so the joins can neither drop nor
    // multiply a row. The count only needs `forms`, and only when the search reads its name.
    const countQuery = tx.select({ total: count() }).from(submissions);
    const totals = await (input.q
      ? countQuery.innerJoin(forms, eq(submissions.formId, forms.id)).where(where)
      : countQuery.where(where));

    return { items, total: totals[0]?.total ?? 0 };
  });
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
 * Reset a `provisioning` flag left by a write that did not land. The flag may belong to another write
 * still in flight; that write sets its own final status.
 */
export const clearSubmissionProvisioning = async (workspaceId: string, submissionId: string) => {
  await db
    .update(submissions)
    .set({ engineSyncStatus: 'ready' })
    .where(
      and(
        eq(submissions.id, submissionId),
        eq(submissions.workspaceId, workspaceId),
        eq(submissions.engineSyncStatus, 'provisioning'),
      ),
    );
};

/**
 * Record an engine failure. Skipped when another write already settled the status or the submission
 * is deleted, so a failed write never overwrites a successful one.
 */
export const failSubmissionProvisioning = async (
  workspaceId: string,
  submissionId: string,
  actorDisplayLabel: string | null,
  message: string,
) => {
  await db
    .update(submissions)
    .set({
      engineSyncStatus: 'error',
      engineSyncError: message,
      updatedBy: actorDisplayLabel,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(submissions.id, submissionId),
        eq(submissions.workspaceId, workspaceId),
        eq(submissions.engineSyncStatus, 'provisioning'),
        isNull(submissions.deletedAt),
      ),
    );
};

const toAppendResult = (
  outcome: 'appended' | 'pending' | 'replayed',
  record: SubmissionRecord,
  revisionId: string,
  revisionNo: number,
  status: RevisionStatusCode,
  reason: RevisionReasonCode,
): AppendSubmissionRevisionResult => ({ outcome, record, revisionId, revisionNo, status, reason });

/**
 * Resolve where a write lands. A 'current' intent whose head still matches its base applies as
 * current/accepted. A 'current' intent whose head moved under the lock is kept as pending, labelled
 * `closed` when the mover made the record terminal and `conflict` otherwise. A 'pending' intent keeps
 * the gate's reason.
 */
const resolveRevisionStanding = (
  intent: Extract<RevisionStatusCode, 'current' | 'pending'>,
  gateReason: RevisionReasonCode,
  headMoved: boolean,
  workflowState: string,
): { applyAsCurrent: boolean; status: RevisionStatusCode; reason: RevisionReasonCode } => {
  if (intent === RevisionStatus.current && !headMoved) {
    return {
      applyAsCurrent: true,
      status: RevisionStatus.current,
      reason: RevisionReason.accepted,
    };
  }
  if (intent === RevisionStatus.current) {
    const reason =
      workflowState === SubmissionWorkflowState.submitted
        ? RevisionReason.closed
        : RevisionReason.conflict;
    return { applyAsCurrent: false, status: RevisionStatus.pending, reason };
  }
  return { applyAsCurrent: false, status: RevisionStatus.pending, reason: gateReason };
};

/**
 * Record a submission revision in one transaction. `revisionNo` is the next append-order number over
 * every revision (current and pending), so it is not the current version's number. A 'current' write
 * whose head still matches its base demotes the outgoing head to `superseded`, inserts the new head as
 * `current`, applies the workflow state, marks the engine sync `ready`, and stamps `submitted_at` on
 * submit; `afterEngineSubmissionRef` becomes the current ref.
 *
 * A 'pending' write - or a 'current' write whose head moved since the gate read it - is recorded off
 * the current chain and the submission row is left entirely untouched (head, current revision no,
 * workflow state, engine ref and sync status all unchanged), so a side-branch write never disturbs the
 * live version. The new engine document stays referenced by the pending revision, so no document is
 * orphaned. A revision id already on the submission is answered as replayed.
 */
export const appendSubmissionRevision = async (
  input: SaveSubmissionInput,
): Promise<AppendSubmissionRevisionResult> => {
  return db.transaction(async (tx) => {
    // The row lock holds other writers on this submission until commit, so the head check and the
    // head move cannot interleave with a concurrent save, submit or delete.
    const [submission] = await tx
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.id, input.submissionId),
          eq(submissions.workspaceId, input.workspaceId),
          isNull(submissions.deletedAt),
        ),
      )
      .limit(1)
      .for('no key update');

    if (!submission) return { outcome: 'not_found' };

    // A concurrent duplicate of this write committed first.
    const [replayed] = await tx
      .select({
        revisionNo: submissionRevisions.revisionNo,
        status: submissionRevisions.status,
        reason: submissionRevisions.reason,
      })
      .from(submissionRevisions)
      .where(
        and(
          eq(submissionRevisions.id, input.revisionId),
          eq(submissionRevisions.submissionId, input.submissionId),
          eq(submissionRevisions.eventType, input.eventType),
        ),
      )
      .limit(1);
    if (replayed) {
      // A current write set 'provisioning' after the winner settled the status; a pending write set
      // nothing, so this reset is a guarded no-op for it.
      const [settled] = await tx
        .update(submissions)
        .set({ engineSyncStatus: 'ready' })
        .where(
          and(
            eq(submissions.id, input.submissionId),
            eq(submissions.engineSyncStatus, 'provisioning'),
          ),
        )
        .returning();
      return toAppendResult(
        'replayed',
        settled ?? submission,
        input.revisionId,
        replayed.revisionNo,
        replayed.status as RevisionStatusCode,
        replayed.reason as RevisionReasonCode,
      );
    }

    // Append order over all revisions; the current version's number lives in current_revision_no.
    const [{ next }] = await tx
      .select({
        next: sql<number>`coalesce(max(${submissionRevisions.revisionNo}), -1) + 1`,
      })
      .from(submissionRevisions)
      .where(
        and(
          eq(submissionRevisions.submissionId, input.submissionId),
          eq(submissionRevisions.workspaceId, input.workspaceId),
        ),
      );
    const nextRevision = Number(next);

    const headMoved = submission.headRevisionId !== input.parentRevisionId;
    const { applyAsCurrent, status, reason } = resolveRevisionStanding(
      input.status,
      input.reason,
      headMoved,
      submission.workflowState,
    );

    await tx.insert(submissionRevisions).values({
      id: input.revisionId,
      workspaceId: input.workspaceId,
      submissionId: input.submissionId,
      revisionNo: nextRevision,
      parentRevisionId: input.parentRevisionId,
      eventType: input.eventType,
      status,
      reason,
      beforeEngineSubmissionRef: applyAsCurrent ? submission.engineSubmissionRef : null,
      afterEngineSubmissionRef: input.afterEngineSubmissionRef,
      changedBy: input.actorId,
    });

    if (!applyAsCurrent) {
      // A pending intent advertised nothing on the submission, so leave the row untouched. A current
      // intent downgraded here (head moved under the lock) had set 'provisioning' before the engine
      // write; clear just that flag, without bumping the current version or its audit fields.
      let record = submission;
      if (input.status === RevisionStatus.current) {
        const [settled] = await tx
          .update(submissions)
          .set({ engineSyncStatus: 'ready' })
          .where(
            and(
              eq(submissions.id, input.submissionId),
              eq(submissions.engineSyncStatus, 'provisioning'),
            ),
          )
          .returning();
        if (settled) record = settled;
      }
      return toAppendResult('pending', record, input.revisionId, nextRevision, status, reason);
    }

    // The outgoing head is the single current revision; demote it before the new head commits.
    if (submission.headRevisionId) {
      await tx
        .update(submissionRevisions)
        .set({ status: RevisionStatus.superseded, reason: RevisionReason.replaced })
        .where(
          and(
            eq(submissionRevisions.id, submission.headRevisionId),
            eq(submissionRevisions.workspaceId, input.workspaceId),
          ),
        );
    }

    const updates: Partial<typeof submissions.$inferInsert> = {
      currentRevisionNo: nextRevision,
      headRevisionId: input.revisionId,
      engineSubmissionRef: input.afterEngineSubmissionRef,
      engineSyncStatus: 'ready',
      engineSyncError: null,
      workflowState: input.workflowState,
      updatedBy: input.actorDisplayLabel,
      updatedAt: new Date(),
    };

    // submittedBy is stamped at open; record the submit timestamp when the submit event lands.
    if (input.eventType === SubmissionEventType.submitted) {
      updates.submittedAt = new Date();
    }

    const [updated] = await tx
      .update(submissions)
      .set(updates)
      .where(
        and(eq(submissions.id, input.submissionId), eq(submissions.workspaceId, input.workspaceId)),
      )
      .returning();

    if (!updated) throw new Error(`Submission ${input.submissionId} missing after head move`);
    return toAppendResult('appended', updated, input.revisionId, nextRevision, status, reason);
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
      workflowState: SubmissionWorkflowState.deleted,
      deletedAt: new Date(),
      deletedBy: actorDisplayLabel,
      updatedBy: actorDisplayLabel,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(submissions.id, submissionId),
        eq(submissions.workspaceId, workspaceId),
        isNull(submissions.deletedAt),
      ),
    )
    .returning();

  return updated[0] ?? null;
};
