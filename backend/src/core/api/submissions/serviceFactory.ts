import { SubmissionService } from '../../services/submissionService';
import { FormVersionService } from '../../services/formVersionService';
import { decodeCursorAndMode, buildNextCursor, type CursorSort } from '../shared/pagination';
import type { SubmissionRecord, SubmissionListRow, SubmissionDetailRow } from '../../db/repos/submissionRepo';

export interface SubmissionsContextInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
}

interface ListSubmissionsQueryInput {
  limit: number;
  cursor?: string;
  formId?: string;
  formVersionId?: string;
  workflowState?: string;
  createdBy?: string;
  sort?: CursorSort;
}

const toSubmissionDto = (item: SubmissionRecord | SubmissionDetailRow) => {
  const detail = item as Partial<SubmissionDetailRow>;
  return {
    id: item.id,
    formId: item.formId,
    formName: detail.form?.name ?? 'Untitled Form',
    formVersionId: item.formVersionId,
    versionNo: detail.formVersion?.versionNo ?? item.currentRevisionNo ?? 1,
    workflowState: item.workflowState,
    engineSyncStatus: item.engineSyncStatus,
    currentRevisionNo: item.currentRevisionNo,
    submittedAt: item.submittedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
};

const toSubmissionListItemDto = (item: SubmissionListRow) => ({
  id: item.id,
  formId: item.formId,
  formName: item.form.name ?? 'Untitled Form',
  formVersionId: item.formVersionId,
  versionNo: item.formVersion.versionNo ?? 1,
  workflowState: item.workflowState,
  engineSyncStatus: item.engineSyncStatus,
  submittedAt: item.submittedAt?.toISOString() ?? null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

export function createSubmissionsApiService(submissionService: SubmissionService) {
  return {
    get: async (ctx: SubmissionsContextInput, submissionId: string) => {
      const row = await submissionService.get(ctx.workspaceId, submissionId);
      return row ? toSubmissionDto(row) : null;
    },

    list: async (ctx: SubmissionsContextInput, query: ListSubmissionsQueryInput) => {
      const { cursorMode, sort, afterId, afterUpdatedAt } = decodeCursorAndMode({
        cursor: query.cursor,
        sort: query.sort,
      });
      const result = await submissionService.list({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        limit: query.limit,
        formId: query.formId,
        formVersionId: query.formVersionId,
        workflowState: query.workflowState,
        createdBy: query.createdBy,
        sort,
        cursorMode,
        afterId,
        afterUpdatedAt,
      });

      const lastItem = result.items[result.items.length - 1];
      const nextCursor = buildNextCursor(lastItem, result.hasMore, cursorMode);

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
          createdBy: query.createdBy,
        },
        sort,
      };
    },

    create: async (
      ctx: SubmissionsContextInput,
      formId: string,
      formVersionId: string,
      workflowState?: string,
    ) =>
      toSubmissionDto(
        await submissionService.create({
          workspaceId: ctx.workspaceId,
          actorId: ctx.actorId,
          actorDisplayLabel: ctx.actorDisplayLabel,
          formId,
          formVersionId,
          workflowState,
        }),
      ),

    update: async (ctx: SubmissionsContextInput, submissionId: string, workflowState?: string) => {
      const row = await submissionService.update({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        actorDisplayLabel: ctx.actorDisplayLabel,
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
          actorDisplayLabel: ctx.actorDisplayLabel,
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
        actorDisplayLabel: ctx.actorDisplayLabel,
        submissionId,
      }),
  };
}

export type SubmissionsApiService = ReturnType<typeof createSubmissionsApiService>;
