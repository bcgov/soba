import { FormService } from '../../services/formService';
import { FormVersionService } from '../../services/formVersionService';
import { decodeCursorAndMode, buildNextCursor, type CursorSort } from '../shared/pagination';
import { createPluginConfigReader } from '../../config/pluginConfig';
import { getAuthenticatedFormioClient } from '../../../plugins/formio-v5/formioV5Client';

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

/** Minimal Form.io form document fields used when merging SOBA metadata into list results. */
type FormioListedForm = Record<string, unknown> & { _id: string };

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
  engineSchemaRef: string | null;
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
  engineSchemaRef: item.engineSchemaRef,
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
  engineSchemaRef: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: item.id,
  formId: item.formId,
  versionNo: item.versionNo,
  state: item.state,
  engineSyncStatus: item.engineSyncStatus,
  engineSchemaRef: item.engineSchemaRef,
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
      const row = await formService.get(ctx.workspaceId, formId);
      return row ? toFormDto(row) : null;
    },

    getFormByEngineRef: async (ctx: FormsContextInput, engineRef: string) => {
      const version = await formVersionService.getByEngineRef(ctx.workspaceId, engineRef);
      if (!version) return null;

      const form = await formService.get(ctx.workspaceId, version.formId);
      if (!form) return null;

      return {
        ...toFormDto(form),
        formVersion: toFormVersionDto(version),
      };
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

    listFormioForms: async (ctx: FormsContextInput, query: ListFormsQueryInput) => {
      const { cursorMode, sort, afterId, afterUpdatedAt } = decodeCursorAndMode({
        cursor: query.cursor,
        sort: query.sort,
      });

      const sobaFormsResult = await formService.list({
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

      if (sobaFormsResult.items.length === 0) {
        return [];
      }

      const formVersionsResult = await formVersionService.list({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        limit: 1000,
        sort: 'id:desc',
        cursorMode: 'id',
      });

      const formMap = new Map(sobaFormsResult.items.map((f) => [f.id, f]));
      const refToSobaMap = new Map();
      const formToRefMap = new Map();
      const refsToFetch: string[] = [];

      for (const v of formVersionsResult.items) {
        if (v.engineSchemaRef && formMap.has(v.formId) && !formToRefMap.has(v.formId)) {
          formToRefMap.set(v.formId, v.engineSchemaRef);
          refToSobaMap.set(v.engineSchemaRef, {
            form: formMap.get(v.formId),
            formVersion: v,
          });
          refsToFetch.push(v.engineSchemaRef);
        }
      }

      if (refsToFetch.length === 0) {
        return [];
      }

      const config = createPluginConfigReader('formio-v5');
      const client = await getAuthenticatedFormioClient(config);
      if (!client) {
        return [];
      }

      const formioForms = (await client.loadForms({
        params: { _id__in: refsToFetch.join(',') },
      })) as FormioListedForm[];

      return formioForms.map((f) => {
        const sobaData = refToSobaMap.get(f._id);
        return {
          ...f,
          _sobaForm: sobaData,
        };
      });
    },

    getFormVersion: async (ctx: FormsContextInput, formVersionId: string) => {
      const row = await formVersionService.get(ctx.workspaceId, formVersionId);
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
      input: {
        eventType?: string;
        note?: string;
        enqueueProvision?: boolean;
        formioFormDefinition?: Record<string, unknown>;
        engine_schema_ref?: string;
      },
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
          formioFormDefinition: input.formioFormDefinition,
          engineSchemaRef: input.engine_schema_ref || null,
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
