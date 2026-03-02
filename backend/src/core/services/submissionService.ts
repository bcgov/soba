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
import {
  SubmissionCreatePayloadSchema,
  type SubmissionCreatePayload,
} from '../integrations/queue/events';
import { NotFoundError, ValidationError } from '../errors';

interface CreateInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formId: string;
  formVersionId: string;
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
  enqueueProvision?: boolean;
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
  sort: SubmissionListSort;
  cursorMode: SubmissionCursorMode;
  afterId?: string;
  afterUpdatedAt?: Date;
}

export class SubmissionService {
  constructor(private readonly queueAdapter: QueueAdapter) {}

  async create(input: CreateInput) {
    return createEmptySubmission(input);
  }

  async update(input: UpdateInput) {
    return updateSubmissionDraft(input.workspaceId, input.submissionId, input.actorDisplayLabel, {
      workflowState: input.workflowState,
    });
  }

  async save(input: SaveInput) {
    const updated = await appendSubmissionRevision({
      workspaceId: input.workspaceId,
      submissionId: input.submissionId,
      actorId: input.actorId,
      actorDisplayLabel: input.actorDisplayLabel,
      eventType: input.eventType,
      changeNote: input.note,
    });

    if (!updated) throw new NotFoundError('Submission not found');

    if (input.enqueueProvision) {
      const formEngineCode = updated.formId
        ? await getFormEngineCodeForForm(input.workspaceId, updated.formId)
        : null;
      if (!formEngineCode) {
        throw new ValidationError(
          'Cannot enqueue submission provision without a valid form engine',
        );
      }
      const payload: SubmissionCreatePayload = SubmissionCreatePayloadSchema.parse({
        submissionId: input.submissionId,
        engineCode: formEngineCode,
        formVersionId: updated.formVersionId ?? undefined,
      });
      await this.queueAdapter.enqueue({
        topic: buildSubmissionCreateTopic(formEngineCode),
        aggregateType: 'submission',
        aggregateId: input.submissionId,
        workspaceId: input.workspaceId,
        payload,
        actorId: input.actorId,
        actorDisplayLabel: input.actorDisplayLabel,
      });
    }

    return updated;
  }

  async delete(input: DeleteInput) {
    return markSubmissionDeleted(
      input.workspaceId,
      input.submissionId,
      input.actorId,
      input.actorDisplayLabel,
    );
  }

  async get(workspaceId: string, actorId: string, submissionId: string) {
    return getSubmissionById(workspaceId, submissionId);
  }

  async list(input: ListInput) {
    return listSubmissionsForWorkspace(input);
  }
}
