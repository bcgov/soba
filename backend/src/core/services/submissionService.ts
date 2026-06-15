import {
  SubmissionCursorMode,
  SubmissionListSort,
  appendSubmissionRevision,
  createEmptySubmission,
  getSubmissionById,
  getSubmissionRecordById,
  listSubmissionsForWorkspace,
  markSubmissionDeleted,
  updateSubmissionDraft,
} from '../db/repos/submissionRepo';
import { getFormVersionById } from '../db/repos/formVersionRepo';
import { getFormEngineCodeForForm } from '../db/repos/formRepo';
import { createFormEngineAdapter } from '../integrations/form-engine/FormEngineRegistry';
import { NotFoundError, ValidationError } from '../errors';

interface CreateInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formId: string;
  formVersionId: string;
  workflowState?: string;
}

interface UpdateInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  submissionId: string;
  workflowState?: string;
}

interface SaveInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  submissionId: string;
  eventType: string;
  note?: string;
  data: Record<string, unknown>;
}

interface DeleteInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  submissionId: string;
}

interface ListInput {
  workspaceId: string;
  actorId: string;
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

export class SubmissionService {
  async create(input: CreateInput) {
    return createEmptySubmission(input);
  }

  async update(input: UpdateInput) {
    return updateSubmissionDraft(input.workspaceId, input.submissionId, input.actorDisplayLabel, {
      workflowState: input.workflowState,
    });
  }

  /**
   * Record a save: create a new (immutable) submission document in the form engine, then advance the
   * PG submission + append a revision capturing the before→after engine refs. Mirrors the forms
   * provisioning flow — status 'provisioning' → 'ready' (in appendSubmissionRevision) or 'error'.
   */
  async save(input: SaveInput) {
    const submission = await getSubmissionRecordById(input.workspaceId, input.submissionId);
    if (!submission) throw new NotFoundError('Submission not found');

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

    try {
      const { engineRef } = await adapter.createSubmission({
        engineFormRef: version.engineSchemaRef,
        submissionId: input.submissionId,
        revisionNo: submission.currentRevisionNo + 1,
        workspaceId: input.workspaceId,
        data: input.data,
      });

      const updated = await appendSubmissionRevision({
        workspaceId: input.workspaceId,
        submissionId: input.submissionId,
        actorId: input.actorId,
        actorDisplayLabel: input.actorDisplayLabel,
        eventType: input.eventType,
        changeNote: input.note,
        afterEngineSubmissionRef: engineRef,
      });

      if (!updated) throw new NotFoundError('Submission not found');

      return updated;
    } catch (err) {
      await updateSubmissionDraft(input.workspaceId, input.submissionId, input.actorDisplayLabel, {
        engineSyncStatus: 'error',
        engineSyncError: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async delete(input: DeleteInput) {
    return markSubmissionDeleted(input.workspaceId, input.submissionId, input.actorDisplayLabel);
  }

  async get(workspaceId: string, submissionId: string) {
    return getSubmissionById(workspaceId, submissionId);
  }

  /** Reads the submission's current answer document back from the form engine (null if unprovisioned). */
  async getContent(input: { workspaceId: string; submissionId: string }) {
    const submission = await getSubmissionRecordById(input.workspaceId, input.submissionId);
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
