import {
  FormVersionCursorMode,
  FormVersionListSort,
  appendFormVersionRevision,
  createEmptyFormVersionDraft,
  getFormVersionById,
  getFormVersionByIdIncludingDeleted,
  getPublishedVersionForForm,
  listFormVersionsForWorkspace,
  updateFormVersionDraft,
  getFormVersionByEngineRef,
} from '../db/repos/formVersionRepo';
import { db } from '../db/client';
import { NotFoundError, ValidationError } from '../errors';

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

interface VersionActionInput {
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

type LifecycleState = 'draft' | 'published' | 'archived' | 'deleted';

const ALLOWED_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  draft: ['published', 'deleted'],
  published: ['archived', 'deleted'],
  archived: ['published', 'deleted'],
  deleted: ['draft'],
};

/** Throws if a form version may not move from `from` to `to`. */
function assertTransition(from: string, to: LifecycleState): void {
  const allowed = ALLOWED_TRANSITIONS[from as LifecycleState] ?? [];
  if (!allowed.includes(to)) {
    throw new ValidationError(`Cannot change form version state from '${from}' to '${to}'`);
  }
}

/**
 * Stamp patch for a target state: sets the matching timestamp/actor columns and nulls the rest,
 * so the stamps always match `state` (only `published` has publishedAt/By, only `deleted` has deletedAt/By).
 */
function stateStamps(
  to: LifecycleState,
  actor: { actorId: string; actorDisplayLabel: string | null },
): {
  state: LifecycleState;
  publishedAt: Date | null;
  publishedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
} {
  const patch = {
    state: to,
    publishedAt: null as Date | null,
    publishedBy: null as string | null,
    deletedAt: null as Date | null,
    deletedBy: null as string | null,
  };
  if (to === 'published') {
    patch.publishedAt = new Date();
    patch.publishedBy = actor.actorId;
  } else if (to === 'deleted') {
    patch.deletedAt = new Date();
    patch.deletedBy = actor.actorDisplayLabel;
  }
  return patch;
}

export class FormVersionService {
  async createDraft(input: CreateDraftInput) {
    return createEmptyFormVersionDraft(input);
  }

  async updateDraft(input: UpdateDraftInput) {
    return updateFormVersionDraft(input.workspaceId, input.formVersionId, input.actorDisplayLabel, {
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
      // Persist engineSchemaRef into the main formVersion row if supplied.
      // A ref means the Form.io document exists, so the version is in sync ('ready').
      if (input.engineSchemaRef != null) {
        await updateFormVersionDraft(
          input.workspaceId,
          input.formVersionId,
          input.actorDisplayLabel,
          { engineSchemaRef: input.engineSchemaRef, engineSyncStatus: 'ready' },
          tx,
        );
      }

      return revised;
    });

    if (!updated) throw new NotFoundError('Form version not found');

    return updated;
  }

  async delete(input: VersionActionInput) {
    const version = await getFormVersionByIdIncludingDeleted(
      input.workspaceId,
      input.formVersionId,
    );
    if (!version) throw new NotFoundError('Form version not found');
    assertTransition(version.state, 'deleted');
    return updateFormVersionDraft(
      input.workspaceId,
      input.formVersionId,
      input.actorDisplayLabel,
      stateStamps('deleted', input),
    );
  }

  async publish(input: VersionActionInput) {
    const version = await getFormVersionById(input.workspaceId, input.formVersionId);
    if (!version) throw new NotFoundError('Form version not found');
    if (version.state === 'published') return version; // idempotent
    assertTransition(version.state, 'published');
    if (version.engineSyncStatus !== 'ready') {
      throw new ValidationError('Form version is not ready to publish');
    }
    return db.transaction(async (tx) => {
      const current = await getPublishedVersionForForm(input.workspaceId, version.formId, tx);
      if (current && current.id !== version.id) {
        await updateFormVersionDraft(
          input.workspaceId,
          current.id,
          input.actorDisplayLabel,
          stateStamps('archived', input),
          tx,
        );
      }
      return updateFormVersionDraft(
        input.workspaceId,
        input.formVersionId,
        input.actorDisplayLabel,
        stateStamps('published', input),
        tx,
      );
    });
  }

  async unpublish(input: VersionActionInput) {
    const version = await getFormVersionById(input.workspaceId, input.formVersionId);
    if (!version) throw new NotFoundError('Form version not found');
    assertTransition(version.state, 'archived');
    return updateFormVersionDraft(
      input.workspaceId,
      input.formVersionId,
      input.actorDisplayLabel,
      stateStamps('archived', input),
    );
  }

  async restore(input: VersionActionInput) {
    const version = await getFormVersionByIdIncludingDeleted(
      input.workspaceId,
      input.formVersionId,
    );
    if (!version) throw new NotFoundError('Form version not found');
    assertTransition(version.state, 'draft');
    return updateFormVersionDraft(
      input.workspaceId,
      input.formVersionId,
      input.actorDisplayLabel,
      stateStamps('draft', input),
    );
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
