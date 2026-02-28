import { actorBelongsToWorkspace } from '../db/repos/membershipRepo';
import {
  SubmissionCursorMode,
  SubmissionListSort,
  appendSubmissionRevision,
  createEmptySubmission,
  getSubmissionById,
  listSubmissionsForWorkspace,
  markSubmissionDeleted,
  updateSubmissionDraft,
} from '../db/repos/submissionRepo';
import { QueueAdapter } from '../integrations/queue/QueueAdapter';
import { getFormEngineCodeForForm } from '../db/repos/formRepo';
import { buildSubmissionCreateTopic } from '../integrations/form-engine/formEngineTopics';

interface CreateInput {
  workspaceId: string;
  actorId: string;
  formId: string;
  formVersionId: string;
}

interface UpdateInput {
  workspaceId: string;
  actorId: string;
  submissionId: string;
  workflowState?: string;
}

interface SaveInput {
  workspaceId: string;
  actorId: string;
  submissionId: string;
  eventType: string;
  note?: string;
  enqueueProvision?: boolean;
}

interface DeleteInput {
  workspaceId: string;
  actorId: string;
  submissionId: string;
}

interface ListInput {
  workspaceId: string;
  actorId: string;
  limit: number;
  formId?: string;
  formVersionId?: string;
  workflowState?: string;
  sort: SubmissionListSort;
  cursorMode: SubmissionCursorMode;
  afterId?: string;
  afterUpdatedAt?: Date;
}

export class SubmissionService {
  constructor(private readonly queueAdapter: QueueAdapter) {}

  async create(input: CreateInput) {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return createEmptySubmission(input);
  }

  async update(input: UpdateInput) {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return updateSubmissionDraft(input.workspaceId, input.submissionId, input.actorId, {
      workflowState: input.workflowState,
    });
  }

  async save(input: SaveInput) {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');

    const updated = await appendSubmissionRevision({
      workspaceId: input.workspaceId,
      submissionId: input.submissionId,
      actorId: input.actorId,
      eventType: input.eventType,
      changeNote: input.note,
    });

    if (!updated) throw new Error('Submission not found');

    if (input.enqueueProvision) {
      const formEngineCode = updated.formId
        ? await getFormEngineCodeForForm(input.workspaceId, updated.formId)
        : null;
      if (!formEngineCode) {
        throw new Error('Cannot enqueue submission provision without a valid form engine');
      }
      await this.queueAdapter.enqueue({
        topic: buildSubmissionCreateTopic(formEngineCode),
        aggregateType: 'submission',
        aggregateId: input.submissionId,
        workspaceId: input.workspaceId,
        payload: { submissionId: input.submissionId, engineCode: formEngineCode },
        actorId: input.actorId,
      });
    }

    return updated;
  }

  async delete(input: DeleteInput) {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return markSubmissionDeleted(input.workspaceId, input.submissionId, input.actorId);
  }

  async get(workspaceId: string, actorId: string, submissionId: string) {
    const inWorkspace = await actorBelongsToWorkspace(workspaceId, actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return getSubmissionById(workspaceId, submissionId);
  }

  async list(input: ListInput) {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return listSubmissionsForWorkspace(input);
  }
}
