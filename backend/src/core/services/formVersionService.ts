import {
  FormVersionCursorMode,
  FormVersionListSort,
  appendFormVersionRevision,
  createEmptyFormVersionDraft,
  getFormVersionById,
  listFormVersionsForWorkspace,
  markFormVersionDeleted,
  updateFormVersionDraft,
} from '../db/repos/formVersionRepo';
import { actorBelongsToWorkspace } from '../db/repos/membershipRepo';
import { QueueAdapter } from '../integrations/queue/QueueAdapter';
import { getFormEngineCodeForForm } from '../db/repos/formRepo';
import { buildFormVersionCreateTopic } from '../integrations/form-engine/formEngineTopics';

interface CreateDraftInput {
  workspaceId: string;
  actorId: string;
  formId: string;
}

interface UpdateDraftInput {
  workspaceId: string;
  actorId: string;
  formVersionId: string;
  state?: string;
}

interface SaveInput {
  workspaceId: string;
  actorId: string;
  formVersionId: string;
  eventType: string;
  note?: string;
  enqueueProvision?: boolean;
}

interface DeleteInput {
  workspaceId: string;
  actorId: string;
  formVersionId: string;
}

interface ListInput {
  workspaceId: string;
  actorId: string;
  limit: number;
  formId?: string;
  state?: string;
  sort: FormVersionListSort;
  cursorMode: FormVersionCursorMode;
  afterId?: string;
  afterUpdatedAt?: Date;
}

export class FormVersionService {
  constructor(private readonly queueAdapter: QueueAdapter) {}

  async createDraft(input: CreateDraftInput) {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return createEmptyFormVersionDraft(input);
  }

  async updateDraft(input: UpdateDraftInput) {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return updateFormVersionDraft(input.workspaceId, input.formVersionId, input.actorId, {
      state: input.state,
    });
  }

  async save(input: SaveInput) {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');

    const updated = await appendFormVersionRevision({
      workspaceId: input.workspaceId,
      formVersionId: input.formVersionId,
      actorId: input.actorId,
      eventType: input.eventType,
      changeNote: input.note,
    });

    if (!updated) throw new Error('Form version not found');

    if (input.eventType === 'publish') {
      await updateFormVersionDraft(input.workspaceId, input.formVersionId, input.actorId, {
        state: 'published',
      });
    }

    if (input.enqueueProvision) {
      const formEngineCode = updated.formId
        ? await getFormEngineCodeForForm(input.workspaceId, updated.formId)
        : null;
      if (!formEngineCode) {
        throw new Error('Cannot enqueue form version provision without a valid form engine');
      }
      await this.queueAdapter.enqueue({
        topic: buildFormVersionCreateTopic(formEngineCode),
        aggregateType: 'form_version',
        aggregateId: input.formVersionId,
        workspaceId: input.workspaceId,
        payload: { formVersionId: input.formVersionId, engineCode: formEngineCode },
        actorId: input.actorId,
      });
    }

    return updated;
  }

  async delete(input: DeleteInput) {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return markFormVersionDeleted(input.workspaceId, input.formVersionId, input.actorId);
  }

  async get(workspaceId: string, actorId: string, formVersionId: string) {
    const inWorkspace = await actorBelongsToWorkspace(workspaceId, actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return getFormVersionById(workspaceId, formVersionId);
  }

  async list(input: ListInput) {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return listFormVersionsForWorkspace(input);
  }
}
