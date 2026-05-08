import {
  FormVersionCursorMode,
  FormVersionListSort,
  appendFormVersionRevision,
  createEmptyFormVersionDraft,
  getFormVersionById,
  listFormVersionsForWorkspace,
  markFormVersionDeleted,
  updateFormVersionDraft,
  getFormVersionByEngineRef,
} from '../db/repos/formVersionRepo';
import { db } from '../db/client';
import { QueueAdapter } from '../integrations/queue/QueueAdapter';
import { getFormById, getFormEngineCodeForForm } from '../db/repos/formRepo';
import { buildFormVersionCreateTopic } from '../integrations/form-engine/formEngineTopics';
import {
  FormVersionCreatePayloadSchema,
  type FormVersionCreatePayload,
} from '../integrations/queue/events';
import { NotFoundError, ValidationError } from '../errors';

interface CreateDraftInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formId: string;
}

interface UpdateDraftInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formVersionId: string;
  state?: string;
}

interface SaveInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formVersionId: string;
  eventType: string;
  note?: string;
  enqueueProvision?: boolean;
  formioFormDefinition?: Record<string, unknown>;
  engineSchemaRef?: string | null;
}

interface DeleteInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
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
    return updateFormVersionDraft(input.workspaceId, input.formVersionId, input.actorDisplayLabel, {
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
          actorDisplayLabel: input.actorDisplayLabel,
          eventType: input.eventType,
          changeNote: input.note,
          engineSchemaRef: input.engineSchemaRef || null,
        },
        tx,
      );
      if (!revised) return null;
      // Persist engineSchemaRef into the main formVersion row if supplied
      if (input.engineSchemaRef != null) {
        await updateFormVersionDraft(
          input.workspaceId,
          input.formVersionId,
          input.actorDisplayLabel,
          { engineSchemaRef: input.engineSchemaRef },
          tx,
        );
      }

      if (input.eventType === 'publish') {
        await updateFormVersionDraft(
          input.workspaceId,
          input.formVersionId,
          input.actorDisplayLabel,
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
      const formRecord =
        updated.formId != null ? await getFormById(input.workspaceId, updated.formId) : null;
      const payload: FormVersionCreatePayload = FormVersionCreatePayloadSchema.parse({
        formVersionId: input.formVersionId,
        engineCode: formEngineCode,
        formId: updated.formId ?? undefined,
        formioFormDefinition: input.formioFormDefinition,
        formSlug: formRecord?.slug,
        formName: formRecord?.name,
      });
      await this.queueAdapter.enqueue({
        topic: buildFormVersionCreateTopic(formEngineCode),
        aggregateType: 'form_version',
        aggregateId: input.formVersionId,
        workspaceId: input.workspaceId,
        payload,
        actorId: input.actorId,
        actorDisplayLabel: input.actorDisplayLabel,
      });
    }

    return updated;
  }

  async delete(input: DeleteInput) {
    return markFormVersionDeleted(input.workspaceId, input.formVersionId, input.actorDisplayLabel);
  }

  async getByEngineRef(workspaceId: string, engineRef: string) {
    return getFormVersionByEngineRef(workspaceId, engineRef);
  }

  async get(workspaceId: string, formVersionId: string) {
    return getFormVersionById(workspaceId, formVersionId);
  }

  async list(input: ListInput) {
    return listFormVersionsForWorkspace(input);
  }
}
