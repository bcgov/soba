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
import { db } from '../db/client';
import { QueueAdapter } from '../integrations/queue/QueueAdapter';
import { getFormEngineCodeForForm } from '../db/repos/formRepo';
import { buildFormVersionCreateTopic } from '../integrations/form-engine/formEngineTopics';
import {
  FormVersionCreatePayloadSchema,
  type FormVersionCreatePayload,
} from '../integrations/queue/events';
import { NotFoundError, ValidationError } from '../errors';

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
    return createEmptyFormVersionDraft(input);
  }

  async updateDraft(input: UpdateDraftInput) {
    return updateFormVersionDraft(input.workspaceId, input.formVersionId, input.actorId, {
      state: input.state,
    });
  }

  async save(input: SaveInput) {
    const updated = await db.transaction(async (tx) => {
      const revised = await appendFormVersionRevision(
        {
          workspaceId: input.workspaceId,
          formVersionId: input.formVersionId,
          actorId: input.actorId,
          eventType: input.eventType,
          changeNote: input.note,
        },
        tx,
      );
      if (!revised) return null;
      if (input.eventType === 'publish') {
        await updateFormVersionDraft(
          input.workspaceId,
          input.formVersionId,
          input.actorId,
          { state: 'published' },
          tx,
        );
      }
      return revised;
    });

    if (!updated) throw new NotFoundError('Form version not found');

    if (input.enqueueProvision) {
      const formEngineCode = updated.formId
        ? await getFormEngineCodeForForm(input.workspaceId, updated.formId)
        : null;
      if (!formEngineCode) {
        throw new ValidationError(
          'Cannot enqueue form version provision without a valid form engine',
        );
      }
      const payload: FormVersionCreatePayload = FormVersionCreatePayloadSchema.parse({
        formVersionId: input.formVersionId,
        engineCode: formEngineCode,
        formId: updated.formId ?? undefined,
      });
      await this.queueAdapter.enqueue({
        topic: buildFormVersionCreateTopic(formEngineCode),
        aggregateType: 'form_version',
        aggregateId: input.formVersionId,
        workspaceId: input.workspaceId,
        payload,
        actorId: input.actorId,
      });
    }

    return updated;
  }

  async delete(input: DeleteInput) {
    return markFormVersionDeleted(input.workspaceId, input.formVersionId, input.actorId);
  }

  async get(workspaceId: string, actorId: string, formVersionId: string) {
    return getFormVersionById(workspaceId, formVersionId);
  }

  async list(input: ListInput) {
    return listFormVersionsForWorkspace(input);
  }
}
