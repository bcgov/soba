import { FormService } from '../../services/formService';
import { FormVersionService } from '../../services/formVersionService';
import type { FormAccessGrant } from '../../db/repos/formAccessRepo';
import type { FormListSort } from '../../db/repos/formRepo';
import type { SubmitterFormListRow } from '../../db/repos/submitterFormRepo';
import type { FormVersionListSort } from '../../db/repos/formVersionRepo';
import {
  type CreateFormSettings,
  type FormListItem,
  type FormVersionListItem,
  type ListMyFormsResponse,
  type MyFormListItem,
  type MyFormListSort,
  type SortLocale,
} from '@soba/lib';
import { LOOKUP_FETCH_LIMIT, toLookupResponse } from '../shared/lookup';

import type { CoreRequestContext } from '../../middleware/requestContext';

export type FormsContextInput = CoreRequestContext;

/** Scope for list/search: the workspaces searched and the access grant rows must pass. */
export interface FormsListScopeInput {
  workspaceIds: string[];
  actorId: string;
  formAccess: FormAccessGrant;
}

/** Scope for a lookup: the workspaces searched. */
export interface FormsLookupScopeInput {
  workspaceIds: string[];
}

interface ListFormsQueryInput {
  workspaceId?: string;
  formId?: string;
  offset: number;
  limit: number;
  q?: string;
  status?: string;
  sort: FormListSort;
  locale: SortLocale;
}

interface ListMyFormsQueryInput {
  offset: number;
  limit: number;
  workspaceId?: string;
  q?: string;
  sort: MyFormListSort;
  locale: SortLocale;
}

interface ListFormVersionsQueryInput {
  workspaceId?: string;
  formId?: string;
  formVersionId?: string;
  offset: number;
  limit: number;
  state?: string;
  sort: FormVersionListSort;
}

interface CreateFormInput {
  name: string;
  description?: string;
  formEngineCode?: string;
  settings?: CreateFormSettings;
}

interface UpdateFormInput {
  name?: string;
  description?: string | null;
  org?: string;
  useCase?: string;
  status?: string;
}

const toFormDto = (item: {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  org: string;
  useCase: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}) => ({
  id: item.id,
  workspaceId: item.workspaceId,
  name: item.name,
  description: item.description,
  org: item.org,
  useCase: item.useCase,
  status: item.status,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  createdBy: item.createdBy,
  updatedBy: item.updatedBy,
});

const toFormListItemDto = (item: {
  id: string;
  workspaceId: string;
  workspaceName: string;
  name: string;
  org: string;
  useCase: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}): FormListItem => ({
  id: item.id,
  workspaceId: item.workspaceId,
  workspaceName: item.workspaceName,
  name: item.name,
  org: item.org,
  useCase: item.useCase,
  status: item.status,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  createdBy: item.createdBy,
  updatedBy: item.updatedBy,
});

const toMyFormListItemDto = (item: SubmitterFormListRow): MyFormListItem => ({
  id: item.id,
  name: item.name,
  workspaceId: item.workspaceId,
  workspaceName: item.workspaceName,
  publishedVersionId: item.publishedVersionId,
  permissions: [...item.permissions],
  audienceMode: item.audienceMode,
  audienceIdps: [...item.audienceIdps],
  allowSubmitterDrafts: item.allowSubmitterDrafts,
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
  createdBy: string | null;
  updatedBy: string | null;
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
  createdBy: item.createdBy,
  updatedBy: item.updatedBy,
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
  createdBy: string | null;
  updatedBy: string | null;
}): FormVersionListItem => ({
  id: item.id,
  formId: item.formId,
  versionNo: item.versionNo,
  state: item.state,
  engineSyncStatus: item.engineSyncStatus,
  engineSchemaRef: item.engineSchemaRef,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  createdBy: item.createdBy,
  updatedBy: item.updatedBy,
});

export function createFormsApiService(
  formService: FormService,
  formVersionService: FormVersionService,
) {
  return {
    createForm: async (ctx: FormsContextInput, input: CreateFormInput) => {
      const { form, version } = await formService.create({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        actorDisplayLabel: ctx.actorDisplayLabel,
        name: input.name,
        description: input.description,
        formEngineCode: input.formEngineCode,
        settings: input.settings,
      });
      return { ...toFormDto(form), formVersion: toFormVersionDto(version) };
    },

    normalizeSchema: (_ctx: FormsContextInput, schema: Record<string, unknown>) =>
      formService.normalizeSchema(schema),

    updateForm: async (ctx: FormsContextInput, formId: string, input: UpdateFormInput) => {
      const row = await formService.update({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        actorDisplayLabel: ctx.actorDisplayLabel,
        formId,
        name: input.name,
        description: input.description,
        org: input.org,
        useCase: input.useCase,
        status: input.status,
      });
      return row ? toFormDto(row) : null;
    },

    getForm: async (ctx: FormsContextInput, formId: string) => {
      const row = await formService.get(ctx.workspaceId, formId);
      if (!row) return null;
      const currentVersion = await formVersionService.getCurrent(ctx.workspaceId, formId);
      return {
        ...toFormDto(row),
        // The caller's permissions on this form, as requireFormPermissions resolved them.
        permissions: [...(ctx.permissions ?? [])].sort((a, b) => a.localeCompare(b)),
        currentVersion,
      };
    },

    list: async (scope: FormsListScopeInput, query: ListFormsQueryInput) => {
      const result = await formService.list({
        workspaceIds: scope.workspaceIds,
        actorId: scope.actorId,
        formAccess: scope.formAccess,
        offset: query.offset,
        limit: query.limit,
        formId: query.formId,
        q: query.q,
        status: query.status,
        sort: query.sort,
        locale: query.locale,
      });

      return {
        items: result.items.map((item) => toFormListItemDto(item)),
        page: {
          offset: query.offset,
          limit: query.limit,
          total: result.total,
        },
        filters: {
          workspaceId: query.workspaceId,
          formId: query.formId,
          q: query.q,
          status: query.status,
        },
        sort: query.sort,
      };
    },

    listMine: async (
      userId: string,
      query: ListMyFormsQueryInput,
    ): Promise<ListMyFormsResponse> => {
      const result = await formService.listForSubmitter({
        userId,
        offset: query.offset,
        limit: query.limit,
        workspaceId: query.workspaceId,
        q: query.q,
        sort: query.sort,
        locale: query.locale,
      });
      return {
        items: result.items.map((item) => toMyFormListItemDto(item)),
        page: { offset: query.offset, limit: query.limit, total: result.total },
        filters: { workspaceId: query.workspaceId, q: query.q },
        sort: query.sort,
      };
    },

    getFormVersion: async (ctx: FormsContextInput, formVersionId: string) => {
      const row = await formVersionService.get(ctx.workspaceId, formVersionId);
      return row ? toFormVersionDto(row) : null;
    },

    listFormVersions: async (scope: FormsListScopeInput, query: ListFormVersionsQueryInput) => {
      const result = await formVersionService.list({
        workspaceIds: scope.workspaceIds,
        actorId: scope.actorId,
        formAccess: scope.formAccess,
        offset: query.offset,
        limit: query.limit,
        formId: query.formId,
        formVersionId: query.formVersionId,
        state: query.state,
        sort: query.sort,
      });

      return {
        items: result.items.map((item) => toFormVersionListItemDto(item)),
        page: {
          offset: query.offset,
          limit: query.limit,
          total: result.total,
        },
        filters: {
          workspaceId: query.workspaceId,
          formId: query.formId,
          formVersionId: query.formVersionId,
          state: query.state,
        },
        sort: query.sort,
      };
    },

    lookupFormVersions: async (
      scope: FormsLookupScopeInput,
      query: { formId: string; q?: string },
    ) =>
      toLookupResponse(
        await formVersionService.lookup({
          workspaceIds: scope.workspaceIds,
          formId: query.formId,
          q: query.q,
          limit: LOOKUP_FETCH_LIMIT,
        }),
      ),

    createDraft: async (ctx: FormsContextInput, formId: string, fromFormVersionId?: string) =>
      toFormVersionDto(
        await formVersionService.createDraft({
          workspaceId: ctx.workspaceId,
          actorId: ctx.actorId,
          actorDisplayLabel: ctx.actorDisplayLabel,
          formId,
          fromFormVersionId,
        }),
      ),

    save: (
      ctx: FormsContextInput,
      formVersionId: string,
      input: {
        eventType?: string;
        note?: string;
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

    publish: async (ctx: FormsContextInput, formVersionId: string) => {
      const row = await formVersionService.publish({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        actorDisplayLabel: ctx.actorDisplayLabel,
        formVersionId,
      });
      return row ? toFormVersionDto(row) : null;
    },

    unpublish: async (ctx: FormsContextInput, formVersionId: string) => {
      const row = await formVersionService.unpublish({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        actorDisplayLabel: ctx.actorDisplayLabel,
        formVersionId,
      });
      return row ? toFormVersionDto(row) : null;
    },

    restore: async (ctx: FormsContextInput, formVersionId: string) => {
      const row = await formVersionService.restore({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        actorDisplayLabel: ctx.actorDisplayLabel,
        formVersionId,
      });
      return row ? toFormVersionDto(row) : null;
    },

    provision: async (
      ctx: FormsContextInput,
      formVersionId: string,
      schema: Record<string, unknown>,
    ) => {
      const row = await formVersionService.provision({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        actorDisplayLabel: ctx.actorDisplayLabel,
        formVersionId,
        schema,
      });
      return row ? toFormVersionDto(row) : null;
    },

    getSchema: (ctx: FormsContextInput, formVersionId: string) =>
      formVersionService.getSchema({ workspaceId: ctx.workspaceId, formVersionId }),

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
