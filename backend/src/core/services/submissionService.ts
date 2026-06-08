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
import { NotFoundError } from '../errors';

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

    return updated;
  }

  async delete(input: DeleteInput) {
    return markSubmissionDeleted(input.workspaceId, input.submissionId, input.actorDisplayLabel);
  }

  async get(workspaceId: string, submissionId: string) {
    return getSubmissionById(workspaceId, submissionId);
  }

  async list(input: ListInput) {
    return listSubmissionsForWorkspace({
      ...input,
    });
  }
}
