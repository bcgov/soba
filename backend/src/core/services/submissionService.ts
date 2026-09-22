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
import { SubmissionEventType, type SubmissionEventTypeCode } from '../db/codes';
import { log } from '../logging';
import { decideSubmissionWrite, STALE_WRITE } from './submissionWriteGate';

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
   * Record a save/submit: decide it up front (replay, lifecycle, stale base), create a new
   * (immutable) submission document in the form engine, then append the revision on top of the base,
   * capturing the before and after engine refs. Sync status goes 'provisioning' then 'ready' or
   * 'error'. A head that moves during the write is a 409 and a deleted submission a 404; both reset
   * 'provisioning'.
   */
  private async record(input: SaveInput, eventType: SubmissionEventTypeCode) {
    const submission = await getSubmissionRecordById(input.workspaceId, input.submissionId);
    if (!submission) throw new NotFoundError('Submission not found');

    const recorded = input.revisionId ? await getSubmissionRevisionById(input.revisionId) : null;
    const decision = decideSubmissionWrite({
      submission,
      eventType,
      baseRevisionId: input.baseRevisionId,
      recorded,
    });
    if (decision.kind === 'replay') return submission;
    const { workflowState, parentRevisionId } = decision;

    if (!input.revisionId) {
      log.info(
        { submissionId: input.submissionId, eventType },
        'Submission write without revision ids',
      );
    }

    const version = await getFormVersionById(input.workspaceId, submission.formVersionId);
    if (!version || !version.engineSchemaRef) {
      throw new ValidationError('Form version is not provisioned in the engine');
    }

    const engineCode = await getFormEngineCodeForForm(input.workspaceId, submission.formId);
    if (!engineCode) {
      throw new ValidationError('Form has no form engine configured');
    }

    const adapter = createFormEngineAdapter(engineCode);
    if (typeof adapter.createSubmission !== 'function') {
      throw new ValidationError(`Form engine '${engineCode}' does not support submissions`);
    }

    await updateSubmissionDraft(input.workspaceId, input.submissionId, input.actorDisplayLabel, {
      engineSyncStatus: 'provisioning',
      engineSyncError: null,
    });

    const revisionId = input.revisionId ?? uuidv7();

    try {
      const { engineRef } = await adapter.createSubmission({
        engineFormRef: version.engineSchemaRef,
        submissionId: input.submissionId,
        revisionId,
        workspaceId: input.workspaceId,
        data: input.data,
      });

      const result = await appendSubmissionRevision({
        workspaceId: input.workspaceId,
        submissionId: input.submissionId,
        revisionId,
        parentRevisionId,
        actorId: input.actorId,
        actorDisplayLabel: input.actorDisplayLabel,
        eventType,
        workflowState,
        afterEngineSubmissionRef: engineRef,
      });

      if (result.outcome === 'not_found') throw new NotFoundError('Submission not found');
      if (result.outcome === 'stale') throw new ConflictError(STALE_WRITE);

      return result.record;
    } catch (err) {
      // A stale or deleted submission is not an engine failure.
      if (err instanceof ConflictError || err instanceof NotFoundError) {
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
