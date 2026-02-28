import { DbOutboxQueueAdapter } from '../../integrations/queue/dbOutboxQueueAdapter';
import { SubmissionService } from '../../services/submissionService';
import { CursorSort, decodeCursor, encodeCursor, resolveCursorMode } from '../shared/pagination';

const queue = new DbOutboxQueueAdapter();
const submissionService = new SubmissionService(queue);

export interface SubmissionsContextInput {
  workspaceId: string;
  actorId: string;
}

interface ListSubmissionsQueryInput {
  limit: number;
  cursor?: string;
  formId?: string;
  formVersionId?: string;
  workflowState?: string;
  sort?: CursorSort;
}

const toSubmissionDto = (item: {
  id: string;
  formId: string;
  formVersionId: string;
  workflowState: string;
  engineSyncStatus: string;
  currentRevisionNo: number;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: item.id,
  formId: item.formId,
  formVersionId: item.formVersionId,
  workflowState: item.workflowState,
  engineSyncStatus: item.engineSyncStatus,
  currentRevisionNo: item.currentRevisionNo,
  submittedAt: item.submittedAt?.toISOString() ?? null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

const toSubmissionListItemDto = (item: {
  id: string;
  formId: string;
  formVersionId: string;
  workflowState: string;
  engineSyncStatus: string;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: item.id,
  formId: item.formId,
  formVersionId: item.formVersionId,
  workflowState: item.workflowState,
  engineSyncStatus: item.engineSyncStatus,
  submittedAt: item.submittedAt?.toISOString() ?? null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

export const submissionsApiService = {
  get: async (ctx: SubmissionsContextInput, submissionId: string) => {
    const row = await submissionService.get(ctx.workspaceId, ctx.actorId, submissionId);
    return row ? toSubmissionDto(row) : null;
  },

  list: async (ctx: SubmissionsContextInput, query: ListSubmissionsQueryInput) => {
    const decodedCursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const cursorMode = resolveCursorMode({ sort: query.sort, cursor: decodedCursor });
    const sort = query.sort ?? 'id:desc';
    const result = await submissionService.list({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      limit: query.limit,
      formId: query.formId,
      formVersionId: query.formVersionId,
      workflowState: query.workflowState,
      sort,
      cursorMode,
      afterId: decodedCursor?.id,
      afterUpdatedAt: decodedCursor?.m === 'ts_id' ? new Date(decodedCursor.ts) : undefined,
    });

    const lastItem = result.items[result.items.length - 1];
    const nextCursor =
      result.hasMore && lastItem
        ? encodeCursor(
            cursorMode === 'ts_id'
              ? { m: 'ts_id', ts: lastItem.updatedAt.toISOString(), id: lastItem.id }
              : { m: 'id', id: lastItem.id },
          )
        : null;

    return {
      items: result.items.map((item) => toSubmissionListItemDto(item)),
      page: {
        limit: query.limit,
        hasMore: result.hasMore,
        nextCursor,
        cursorMode,
      },
      filters: {
        formId: query.formId,
        formVersionId: query.formVersionId,
        workflowState: query.workflowState,
      },
      sort,
    };
  },

  create: async (ctx: SubmissionsContextInput, formId: string, formVersionId: string) =>
    toSubmissionDto(
      await submissionService.create({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        formId,
        formVersionId,
      }),
    ),

  update: async (ctx: SubmissionsContextInput, submissionId: string, workflowState?: string) => {
    const row = await submissionService.update({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      submissionId,
      workflowState,
    });
    return row ? toSubmissionDto(row) : null;
  },

  save: (
    ctx: SubmissionsContextInput,
    submissionId: string,
    input: { eventType?: string; note?: string; enqueueProvision?: boolean },
  ) =>
    submissionService
      .save({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        submissionId,
        eventType: input.eventType || 'edit_submission',
        note: input.note,
        enqueueProvision: input.enqueueProvision ?? true,
      })
      .then((row) => toSubmissionDto(row)),

  delete: (ctx: SubmissionsContextInput, submissionId: string) =>
    submissionService.delete({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      submissionId,
    }),
};
