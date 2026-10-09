import { SubmissionService, type SubmissionWriteOutcome } from '../../services/submissionService';
import { SubmissionWorkflowState } from '../../db/codes';
import type { FormAccessGrant } from '../../db/repos/formAccessRepo';
import type {
  ParticipantSubmissionListRow,
  SubmissionRecord,
  SubmissionListRow,
  SubmissionDetailRow,
} from '../../db/repos/submissionRepo';
import type {
  ListMySubmissionsResponse,
  MySubmissionRole,
  MySubmissionState,
  OpenSubmissionBody,
  SubmissionDataBody,
  SortLocale,
  SubmissionListSort,
  SubmitSubmissionBody,
} from '@soba/lib';

export interface SubmissionsContextInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
}

/** Scope for list/search: the workspaces searched and the access grant rows must pass. */
export interface SubmissionsListScopeInput {
  workspaceIds: string[];
  actorId: string;
  formAccess: FormAccessGrant;
}

export interface ListSubmissionsQueryInput {
  workspaceId?: string;
  formId?: string;
  formVersionId?: string;
  submissionId?: string;
  offset: number;
  limit: number;
  workflowState?: string;
  createdBy?: string;
  q?: string;
  sort: SubmissionListSort;
  locale: SortLocale;
}

export interface ListMySubmissionsQueryInput {
  offset: number;
  limit: number;
  workflowState?: MySubmissionState;
  q?: string;
  sort: SubmissionListSort;
  locale: SortLocale;
}

// The code exists from open but is shown only once the submission is submitted.
const confirmationCodeOf = (item: { workflowState: string; confirmationCode: string }) =>
  item.workflowState === SubmissionWorkflowState.submitted ? item.confirmationCode : null;

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
    headRevisionId: item.headRevisionId,
    submittedAt: item.submittedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    createdBy: detail.createdBy ?? null,
    submittedBy: detail.submittedBy ?? null,
    confirmationCode: confirmationCodeOf(item),
  };
};

const toSubmissionWriteDto = (outcome: SubmissionWriteOutcome) => ({
  ...toSubmissionDto(outcome.record),
  revision: outcome.revision,
});

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
  createdBy: item.createdBy,
  submittedBy: item.submittedBy,
  confirmationCode: confirmationCodeOf(item),
});

const toMySubmissionListItemDto = (item: ParticipantSubmissionListRow) => ({
  id: item.id,
  formId: item.formId,
  formName: item.formName,
  workflowState: item.workflowState as MySubmissionState,
  role: item.role as MySubmissionRole,
  submittedAt: item.submittedAt?.toISOString() ?? null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  confirmationCode: confirmationCodeOf(item),
});

export function createSubmissionsApiService(submissionService: SubmissionService) {
  return {
    get: async (ctx: SubmissionsContextInput, submissionId: string) => {
      const row = await submissionService.get(ctx.workspaceId, submissionId);
      return row ? toSubmissionDto(row) : null;
    },

    getData: (ctx: SubmissionsContextInput, submissionId: string) =>
      submissionService.getContent({ workspaceId: ctx.workspaceId, submissionId }),

    list: async (scope: SubmissionsListScopeInput, query: ListSubmissionsQueryInput) => {
      const result = await submissionService.list({
        workspaceIds: scope.workspaceIds,
        actorId: scope.actorId,
        formAccess: scope.formAccess,
        offset: query.offset,
        limit: query.limit,
        formId: query.formId,
        formVersionId: query.formVersionId,
        submissionId: query.submissionId,
        workflowState: query.workflowState,
        createdBy: query.createdBy,
        q: query.q,
        sort: query.sort,
        locale: query.locale,
      });

      return {
        items: result.items.map((item) => toSubmissionListItemDto(item)),
        page: {
          offset: query.offset,
          limit: query.limit,
          total: result.total,
        },
        filters: {
          workspaceId: query.workspaceId,
          formId: query.formId,
          formVersionId: query.formVersionId,
          submissionId: query.submissionId,
          workflowState: query.workflowState,
          createdBy: query.createdBy,
          q: query.q,
        },
        sort: query.sort,
      };
    },

    listMine: async (
      userId: string,
      query: ListMySubmissionsQueryInput,
    ): Promise<ListMySubmissionsResponse> => {
      const result = await submissionService.listForParticipant({
        userId,
        offset: query.offset,
        limit: query.limit,
        workflowState: query.workflowState,
        q: query.q,
        sort: query.sort,
        locale: query.locale,
      });
      return {
        items: result.items.map((item) => toMySubmissionListItemDto(item)),
        page: { offset: query.offset, limit: query.limit, total: result.total },
        filters: { workflowState: query.workflowState, q: query.q },
        sort: query.sort,
      };
    },

    open: async (ctx: SubmissionsContextInput, body: OpenSubmissionBody) => {
      const { created, record } = await submissionService.open({ ...ctx, ...body });
      return { created, submission: toSubmissionDto(record) };
    },

    save: (ctx: SubmissionsContextInput, submissionId: string, body: SubmissionDataBody) =>
      submissionService
        .save({ ...ctx, submissionId, ...body })
        .then((outcome) => toSubmissionWriteDto(outcome)),

    submit: (ctx: SubmissionsContextInput, submissionId: string, body: SubmitSubmissionBody) =>
      submissionService
        .submit({ ...ctx, submissionId, ...body })
        .then((outcome) => toSubmissionWriteDto(outcome)),

    delete: (ctx: SubmissionsContextInput, submissionId: string) =>
      submissionService.delete({ ...ctx, submissionId }),

    deleteUnsubmitted: (ctx: SubmissionsContextInput, submissionId: string) =>
      submissionService.deleteUnsubmitted({ ...ctx, submissionId }),
  };
}

export type SubmissionsApiService = ReturnType<typeof createSubmissionsApiService>;
