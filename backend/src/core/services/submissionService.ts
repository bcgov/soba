import type { SubmissionListSort } from '@soba/lib';
import { v7 as uuidv7 } from 'uuid';
import {
  appendSubmissionRevision,
  clearSubmissionProvisioning,
  failSubmissionProvisioning,
  openSubmission,
  getSubmissionById,
  getSubmissionRecordById,
  getSubmissionRevisionById,
  listSubmissionsForWorkspace,
  markSubmissionDeleted,
  updateSubmissionDraft,
  type SubmissionRecord,
} from '../db/repos/submissionRepo';
import { getFormVersionById, getPublishedVersionForForm } from '../db/repos/formVersionRepo';
import { getFormEngineCodeForForm } from '../db/repos/formRepo';
import { createFormEngineAdapter } from '../integrations/form-engine/FormEngineRegistry';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import {
  RevisionReason,
  RevisionStatus,
  SubmissionEventType,
  type RevisionReasonCode,
  type RevisionStatusCode,
  type SubmissionEventTypeCode,
  type SubmissionWorkflowStateCode,
} from '../db/codes';
import { log } from '../logging';
import { decideSubmissionWrite, type SubmissionWriteDecision } from './submissionWriteGate';

export interface SubmissionWriteOutcome {
  record: SubmissionRecord;
  /** Where this write landed: `current` applied it, `pending` held it for review. */
  revision: {
    id: string;
    revisionNo: number;
    status: RevisionStatusCode;
    reason: RevisionReasonCode;
  };
}

interface CreateInput {
  /** Client-minted uuidv7 that becomes the submission id. */
  id: string;
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formId: string;
  /** Must be the form's published version when given. */
  formVersionId?: string;
}

interface SaveInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  submissionId: string;
  data: Record<string, unknown>;
  /** Client-minted id for this write; the server mints one when absent. */
  revisionId?: string;
  /** Head the client loaded; the current head is assumed when absent. */
  baseRevisionId?: string;
}

interface DeleteInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  submissionId: string;
}

interface ListInput {
  workspaceIds: string[];
  actorId: string;
  offset: number;
  limit: number;
  formId?: string;
  formVersionId?: string;
  submissionId?: string;
  workflowState?: string;
  createdBy?: string;
  q?: string;
  sort: SubmissionListSort;
}

export class SubmissionService {
  /**
   * Open a new submission against the form's currently published version (the only submittable one),
   * under the client-supplied id. Idempotent: a retry of the same id by the same actor+form returns
   * the existing record ({ created: false }); a collision with a different owner is a 409. A
   * formVersionId that is not the published version is a 409.
   */
  async open(input: CreateInput) {
    const version = await getPublishedVersionForForm(input.workspaceId, input.formId);
    if (!version) throw new NotFoundError('Form has no published version');
    if (input.formVersionId && input.formVersionId !== version.id) {
      throw new ConflictError('Form version is not the published version');
    }

    const result = await openSubmission({ ...input, formVersionId: version.id });
    if (result.outcome === 'conflict') {
      throw new ConflictError('Submission id already in use');
    }
    return { created: result.outcome === 'created', record: result.record };
  }

  /** Save the current answer data as a draft (opened → draft; draft stays draft). */
  async save(input: SaveInput) {
    return this.record(input, SubmissionEventType.saved);
  }

  /** Submit the answer data (opened/draft → submitted). */
  async submit(input: SaveInput) {
    return this.record(input, SubmissionEventType.submitted);
  }

  /**
   * Record a save/submit: decide it up front (replay, current or pending), then write it. A `current`
   * write appends on top of the head; a `pending` write - a conflict or a write against a submitted
   * record - is kept off the current chain for staff to resolve, leaving the current version and
   * workflow state untouched. The returned revision says where the write landed.
   */
  private async record(
    input: SaveInput,
    eventType: SubmissionEventTypeCode,
  ): Promise<SubmissionWriteOutcome> {
    const submission = await getSubmissionRecordById(input.workspaceId, input.submissionId);
    if (!submission) throw new NotFoundError('Submission not found');

    const recorded = input.revisionId ? await getSubmissionRevisionById(input.revisionId) : null;
    const decision = decideSubmissionWrite({
      submission,
      eventType,
      baseRevisionId: input.baseRevisionId,
      recorded,
    });
    if (decision.kind === 'replay') {
      // The gate returns replay only when a matching revision was recorded. Report the write's landing
      // disposition, not the revision's current standing: a revision that landed as current and was
      // later superseded still replays as `current`, never `superseded`.
      const revision = recorded!;
      const landedPending = revision.status === RevisionStatus.pending;
      return {
        record: submission,
        revision: {
          id: input.revisionId!,
          revisionNo: revision.revisionNo,
          status: landedPending ? RevisionStatus.pending : RevisionStatus.current,
          reason: landedPending ? (revision.reason as RevisionReasonCode) : RevisionReason.accepted,
        },
      };
    }

    // The base must be a revision of this submission. A foreign or unknown base is a malformed write,
    // rejected before any engine document is created, so it cannot orphan one or branch across
    // submissions. A base equal to the head is trivially valid.
    if (input.baseRevisionId && input.baseRevisionId !== submission.headRevisionId) {
      const base = await getSubmissionRevisionById(input.baseRevisionId);
      if (!base || base.submissionId !== input.submissionId) {
        throw new ValidationError('baseRevisionId is not a revision of this submission');
      }
    }

    return this.writeRevision(input, submission, eventType, decision);
  }

  /**
   * Create a new (immutable) submission document in the form engine, then record the revision. A
   * `current` write advertises 'provisioning' on the submission, then 'ready' or (on engine failure)
   * 'error'; a deleted submission is a 404 that resets 'provisioning'. A `pending` write never touches
   * the submission's sync status - it is a side branch, so an engine failure on it leaves the live
   * version untouched.
   */
  /**
   * Resolve the submission's own form version and its engine adapter for a write, or throw a
   * ValidationError when the version is unprovisioned, the form has no engine, or the engine does not
   * support submissions.
   */
  private async resolveSubmissionEngine(submission: SubmissionRecord) {
    const version = await getFormVersionById(submission.workspaceId, submission.formVersionId);
    if (!version || !version.engineSchemaRef) {
      throw new ValidationError('Form version is not provisioned in the engine');
    }

    const engineCode = await getFormEngineCodeForForm(submission.workspaceId, submission.formId);
    if (!engineCode) {
      throw new ValidationError('Form has no form engine configured');
    }

    const adapter = createFormEngineAdapter(engineCode);
    if (typeof adapter.createSubmission !== 'function') {
      throw new ValidationError(`Form engine '${engineCode}' does not support submissions`);
    }

    return {
      engineSchemaRef: version.engineSchemaRef,
      createSubmission: adapter.createSubmission.bind(adapter),
    };
  }

  private async writeRevision(
    input: SaveInput,
    submission: SubmissionRecord,
    eventType: SubmissionEventTypeCode,
    decision: Exclude<SubmissionWriteDecision, { kind: 'replay' }>,
  ): Promise<SubmissionWriteOutcome> {
    if (!input.revisionId) {
      log.info(
        { submissionId: input.submissionId, eventType },
        'Submission write without revision ids',
      );
    }

    const { engineSchemaRef, createSubmission } = await this.resolveSubmissionEngine(submission);
    const pending = decision.kind === 'pending';

    // Only a current write advertises in-flight status on the live submission; a pending write is a
    // side branch and must leave the row alone.
    if (!pending) {
      await updateSubmissionDraft(input.workspaceId, input.submissionId, input.actorDisplayLabel, {
        engineSyncStatus: 'provisioning',
        engineSyncError: null,
      });
    }

    const revisionId = input.revisionId ?? uuidv7();

    try {
      const { engineRef } = await createSubmission({
        engineFormRef: engineSchemaRef,
        submissionId: input.submissionId,
        revisionId,
        workspaceId: input.workspaceId,
        data: input.data,
      });

      const result = await appendSubmissionRevision({
        workspaceId: input.workspaceId,
        submissionId: input.submissionId,
        revisionId,
        parentRevisionId: decision.parentRevisionId,
        actorId: input.actorId,
        actorDisplayLabel: input.actorDisplayLabel,
        eventType,
        status: pending ? RevisionStatus.pending : RevisionStatus.current,
        reason: pending ? decision.reason : RevisionReason.accepted,
        workflowState: pending
          ? (submission.workflowState as SubmissionWorkflowStateCode)
          : decision.workflowState,
        afterEngineSubmissionRef: engineRef,
      });

      if (result.outcome === 'not_found') throw new NotFoundError('Submission not found');

      return {
        record: result.record,
        revision: {
          id: result.revisionId,
          revisionNo: result.revisionNo,
          status: result.status,
          reason: result.reason,
        },
      };
    } catch (err) {
      // A pending write never set a provisioning flag, so there is nothing to reset for it.
      if (pending) throw err;
      // A deleted submission is not an engine failure.
      if (err instanceof NotFoundError) {
        await clearSubmissionProvisioning(input.workspaceId, input.submissionId);
        throw err;
      }
      await failSubmissionProvisioning(
        input.workspaceId,
        input.submissionId,
        input.actorDisplayLabel,
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  }

  async delete(input: DeleteInput) {
    return markSubmissionDeleted(input.workspaceId, input.submissionId, input.actorDisplayLabel);
  }

  async get(workspaceId: string, submissionId: string) {
    return getSubmissionById(workspaceId, submissionId);
  }

  /**
   * Reads the submission's current answer document back from the form engine (null if unprovisioned).
   * Pass `record` to reuse an already-loaded submission row instead of re-fetching it.
   */
  async getContent(input: {
    workspaceId: string;
    submissionId: string;
    record?: SubmissionRecord;
  }) {
    const submission =
      input.record ?? (await getSubmissionRecordById(input.workspaceId, input.submissionId));
    if (!submission || !submission.engineSubmissionRef) return null;

    const version = await getFormVersionById(input.workspaceId, submission.formVersionId);
    if (!version || !version.engineSchemaRef) return null;

    const engineCode = await getFormEngineCodeForForm(input.workspaceId, submission.formId);
    if (!engineCode) return null;

    const adapter = createFormEngineAdapter(engineCode);
    if (typeof adapter.readSubmission !== 'function') return null;

    return adapter.readSubmission(version.engineSchemaRef, submission.engineSubmissionRef);
  }

  async list(input: ListInput) {
    return listSubmissionsForWorkspace({
      ...input,
    });
  }
}
