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
import { NotFoundError } from '../errors';

interface CreateDraftInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formId: string;
  visibility?: string[];
}

interface UpdateDraftInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formVersionId: string;
  state?: string;
  visibility?: string[];
}

interface SaveInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formVersionId: string;
  eventType: string;
  note?: string;
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
  async createDraft(input: CreateDraftInput) {
    return createEmptyFormVersionDraft(input);
  }

  async updateDraft(input: UpdateDraftInput) {
    return updateFormVersionDraft(input.workspaceId, input.formVersionId, input.actorDisplayLabel, {
      state: input.state,
      visibility: input.visibility,
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
