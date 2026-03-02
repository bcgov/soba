import { FormService } from '../../services/formService';
import { FormVersionService } from '../../services/formVersionService';
import { decodeCursorAndMode, buildNextCursor, type CursorSort } from '../shared/pagination';

export interface FormsContextInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
}

interface ListFormsQueryInput {
  limit: number;
  cursor?: string;
  q?: string;
  status?: string;
  sort?: CursorSort;
}

interface ListFormVersionsQueryInput {
  limit: number;
  cursor?: string;
  formId?: string;
  state?: string;
  sort?: CursorSort;
}

interface CreateFormInput {
  slug: string;
  name: string;
  description?: string;
  formEngineCode?: string;
}

interface UpdateFormInput {
  slug?: string;
  name?: string;
  description?: string | null;
  status?: string;
}

const toFormDto = (item: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: item.id,
  slug: item.slug,
  name: item.name,
  description: item.description,
  status: item.status,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

const toFormListItemDto = (item: {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: item.id,
  slug: item.slug,
  name: item.name,
  status: item.status,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

const toFormVersionDto = (item: {
  id: string;
  formId: string;
  versionNo: number;
  state: string;
  engineSyncStatus: string;
  currentRevisionNo: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: item.id,
  formId: item.formId,
  versionNo: item.versionNo,
  state: item.state,
  engineSyncStatus: item.engineSyncStatus,
  currentRevisionNo: item.currentRevisionNo,
  publishedAt: item.publishedAt?.toISOString() ?? null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

const toFormVersionListItemDto = (item: {
  id: string;
  formId: string;
  versionNo: number;
  state: string;
  engineSyncStatus: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: item.id,
  formId: item.formId,
  versionNo: item.versionNo,
  state: item.state,
  engineSyncStatus: item.engineSyncStatus,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

export function createFormsApiService(
  formService: FormService,
  formVersionService: FormVersionService,
) {
  return {
    createForm: async (ctx: FormsContextInput, input: CreateFormInput) =>
      toFormDto(
        await formService.create({
          workspaceId: ctx.workspaceId,
          actorId: ctx.actorId,
          actorDisplayLabel: ctx.actorDisplayLabel,
          slug: input.slug,
          name: input.name,
          description: input.description,
          formEngineCode: input.formEngineCode,
        }),
      ),

    updateForm: async (ctx: FormsContextInput, formId: string, input: UpdateFormInput) => {
      const row = await formService.update({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        actorDisplayLabel: ctx.actorDisplayLabel,
        formId,
        slug: input.slug,
        name: input.name,
        description: input.description,
        status: input.status,
      });
      return row ? toFormDto(row) : null;
    },

    getForm: async (ctx: FormsContextInput, formId: string) => {
      const row = await formService.get(ctx.workspaceId, ctx.actorId, formId);
      return row ? toFormDto(row) : null;
    },

    list: async (ctx: FormsContextInput, query: ListFormsQueryInput) => {
      const { cursorMode, sort, afterId, afterUpdatedAt } = decodeCursorAndMode({
        cursor: query.cursor,
        sort: query.sort,
      });
      const result = await formService.list({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        limit: query.limit,
        q: query.q,
        status: query.status,
        sort,
        cursorMode,
        afterId,
        afterUpdatedAt,
      });

      const lastItem = result.items[result.items.length - 1];
      const nextCursor = buildNextCursor(lastItem, result.hasMore, cursorMode);

      return {
        items: result.items.map((item) => toFormListItemDto(item)),
        page: {
          limit: query.limit,
          hasMore: result.hasMore,
          nextCursor,
          cursorMode,
        },
        filters: {
          q: query.q,
          status: query.status,
        },
        sort,
      };
    },

    getFormVersion: async (ctx: FormsContextInput, formVersionId: string) => {
      const row = await formVersionService.get(ctx.workspaceId, ctx.actorId, formVersionId);
      return row ? toFormVersionDto(row) : null;
    },

    listFormVersions: async (ctx: FormsContextInput, query: ListFormVersionsQueryInput) => {
      const { cursorMode, sort, afterId, afterUpdatedAt } = decodeCursorAndMode({
        cursor: query.cursor,
        sort: query.sort,
      });
      const result = await formVersionService.list({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        limit: query.limit,
        formId: query.formId,
        state: query.state,
        sort,
        cursorMode,
        afterId,
        afterUpdatedAt,
      });

      const lastItem = result.items[result.items.length - 1];
      const nextCursor = buildNextCursor(lastItem, result.hasMore, cursorMode);

      return {
        items: result.items.map((item) => toFormVersionListItemDto(item)),
        page: {
          limit: query.limit,
          hasMore: result.hasMore,
          nextCursor,
          cursorMode,
        },
        filters: {
          formId: query.formId,
          state: query.state,
        },
        sort,
      };
    },

    createDraft: async (ctx: FormsContextInput, formId: string) =>
      toFormVersionDto(
        await formVersionService.createDraft({
          workspaceId: ctx.workspaceId,
          actorId: ctx.actorId,
          actorDisplayLabel: ctx.actorDisplayLabel,
          formId,
        }),
      ),

    updateDraft: async (ctx: FormsContextInput, formVersionId: string, state?: string) => {
      const row = await formVersionService.updateDraft({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        actorDisplayLabel: ctx.actorDisplayLabel,
        formVersionId,
        state,
      });
      return row ? toFormVersionDto(row) : null;
    },

    save: (
      ctx: FormsContextInput,
      formVersionId: string,
      input: { eventType?: string; note?: string; enqueueProvision?: boolean },
    ) =>
      formVersionService
        .save({
          workspaceId: ctx.workspaceId,
          actorId: ctx.actorId,
          actorDisplayLabel: ctx.actorDisplayLabel,
          formVersionId,
          eventType: input.eventType || 'save_draft',
          note: input.note,
          enqueueProvision: input.enqueueProvision ?? true,
        })
        .then((row) => toFormVersionDto(row)),

    delete: (ctx: FormsContextInput, formVersionId: string) =>
      formVersionService.delete({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        actorDisplayLabel: ctx.actorDisplayLabel,
        formVersionId,
      }),

    deleteForm: (ctx: FormsContextInput, formId: string) =>
      formService.delete({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        actorDisplayLabel: ctx.actorDisplayLabel,
        formId,
      }),
  };
}

export type FormsApiService = ReturnType<typeof createFormsApiService>;
