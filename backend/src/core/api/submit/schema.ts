import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  OpenSubmissionBodySchema,
  SubmissionDataBodySchema,
  SubmissionIdParamsSchema,
  SubmissionResponseSchema,
  SubmissionWriteResponseSchema,
  SubmitSubmissionBodySchema,
  SubmissionSortSchema,
} from '../submissions/schema';
import {
  offsetQueryFields,
  rejectedCursorField,
  searchQueryField,
  sortLocaleQueryField,
  OffsetPageSchema,
  OFFSET_DRIFT_NOTE,
} from '../shared/offsetPagination';
import { MAX_LOOKUP_LIMIT } from '../shared/lookup';
import {
  SubmitFillBundleSchema as LibSubmitFillBundleSchema,
  MySubmissionStateSchema as LibMySubmissionStateSchema,
  MySubmissionRoleSchema as LibMySubmissionRoleSchema,
  MySubmissionListItemSchema as LibMySubmissionListItemSchema,
  ListMySubmissionsResponseSchema as LibListMySubmissionsResponseSchema,
  MyFormSortSchema as LibMyFormSortSchema,
  MyFormListItemSchema as LibMyFormListItemSchema,
  ListMyFormsResponseSchema as LibListMyFormsResponseSchema,
  MyWorkspaceLookupItemSchema as LibMyWorkspaceLookupItemSchema,
  MyWorkspaceLookupResponseSchema as LibMyWorkspaceLookupResponseSchema,
} from '@soba/lib';

extendZodWithOpenApi(z);

export const SubmitFillBundleSchema =
  LibSubmitFillBundleSchema.clone().openapi('Submit_FillBundle');

export const MyFormSortSchema = LibMyFormSortSchema.clone().openapi('Submit_MyFormSort', {
  description: 'Valid My Forms sort tokens: `field:asc` or `field:desc`.',
});

export const ListMyFormsQuerySchema = z
  .object({
    ...offsetQueryFields,
    cursor: rejectedCursorField,
    workspaceId: z.uuid().optional().openapi({ description: 'Only forms in this workspace.' }),
    q: searchQueryField.openapi({ description: 'Matches anywhere in the form name.' }),
    sort: MyFormSortSchema.default('name:asc'),
    locale: sortLocaleQueryField,
  })
  .openapi('Submit_ListMyFormsQuery');

export const MyFormListItemSchema =
  LibMyFormListItemSchema.clone().openapi('Submit_MyFormListItem');

export const ListMyFormsResponseSchema = LibListMyFormsResponseSchema.extend({
  items: z.array(MyFormListItemSchema),
  page: OffsetPageSchema,
  sort: MyFormSortSchema,
}).openapi('Submit_ListMyFormsResponse');

export const MyWorkspaceLookupQuerySchema = z
  .object({ locale: sortLocaleQueryField })
  .openapi('Submit_MyWorkspaceLookupQuery');

export const MyWorkspaceLookupItemSchema = LibMyWorkspaceLookupItemSchema.clone().openapi(
  'Submit_MyWorkspaceLookupItem',
);

export const MyWorkspaceLookupResponseSchema = LibMyWorkspaceLookupResponseSchema.extend({
  items: z.array(MyWorkspaceLookupItemSchema),
}).openapi('Submit_MyWorkspaceLookupResponse');

export const MySubmissionStateSchema = LibMySubmissionStateSchema.clone().openapi(
  'Submit_MySubmissionState',
);

export const ListMySubmissionsQuerySchema = z
  .object({
    ...offsetQueryFields,
    cursor: rejectedCursorField,
    workflowState: MySubmissionStateSchema.optional(),
    q: searchQueryField.openapi({
      description: 'Matches anywhere in the form name, or a submitted confirmation code.',
    }),
    sort: SubmissionSortSchema.default('updatedAt:desc'),
    locale: sortLocaleQueryField,
  })
  .openapi('Submit_ListMySubmissionsQuery');

export const MySubmissionRoleSchema =
  LibMySubmissionRoleSchema.clone().openapi('Submit_MySubmissionRole');

export const MySubmissionListItemSchema = LibMySubmissionListItemSchema.extend({
  workflowState: MySubmissionStateSchema,
  role: MySubmissionRoleSchema,
}).openapi('Submit_MySubmissionListItem');

export const ListMySubmissionsResponseSchema = LibListMySubmissionsResponseSchema.extend({
  items: z.array(MySubmissionListItemSchema),
  page: OffsetPageSchema,
  filters: z.object({
    workflowState: MySubmissionStateSchema.optional(),
    q: z.string().optional(),
  }),
  sort: SubmissionSortSchema,
}).openapi('Submit_ListMySubmissionsResponse');

const TAG = 'core.submit';
const SUBMISSION_PATH = '/submit/submissions/{id}';
const SUBMISSION_NOT_FOUND = 'Submission not found';
const AUTHZ = "Not in the form's audience";
const AUTH_REQUIRED = 'Authentication required (form is not public)';
const NOT_PARTICIPANT = 'Not a participant on this submission';
const WRITE_AUTHZ = "Not a participant on this submission, or not in the form's audience";
const SUBMISSION_AUTH_REQUIRED =
  'Authentication required (anonymous caller has no access to this submission)';
const INVALID_WRITE_BODY =
  'Invalid body (save requires revisionId and baseRevisionId; submit takes both or neither)';
const WRITE_CONFLICT = 'The revision id is already used by another write';
const SIGNED_IN_REQUIRED = 'Authentication required';
const INVALID_QUERY = 'Invalid query';
// Optional auth: anonymous (the public user) or a bearer token. `{}` marks the no-auth case
// explicit rather than leaving security unset.
const PUBLIC_SECURITY = [{}, { bearerAuth: [] }];

export const registerSubmitOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: `${SUBMISSION_PATH}/schema`,
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: { params: SubmissionIdParamsSchema },
    responses: {
      200: {
        description:
          "The submission's own form-version schema, for the read-only confirmation view",
        content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } },
      },
      401: { description: SUBMISSION_AUTH_REQUIRED },
      403: { description: NOT_PARTICIPANT },
      404: { description: 'Submission or schema not found' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${SUBMISSION_PATH}/fill`,
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: { params: SubmissionIdParamsSchema },
    responses: {
      200: {
        description:
          'Workflow state + schema + saved answers + write and draft access for the fill page (resume)',
        content: { 'application/json': { schema: SubmitFillBundleSchema } },
      },
      401: { description: SUBMISSION_AUTH_REQUIRED },
      403: { description: NOT_PARTICIPANT },
      404: { description: 'Submission or schema not found' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/submit/submissions',
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: OpenSubmissionBodySchema } },
      },
    },
    responses: {
      201: {
        description: 'Created submission',
        content: { 'application/json': { schema: SubmissionResponseSchema } },
      },
      200: {
        description: 'Existing submission (idempotent open: same id, actor, and form)',
        content: { 'application/json': { schema: SubmissionResponseSchema } },
      },
      401: { description: AUTH_REQUIRED },
      403: { description: AUTHZ },
      409: {
        description:
          'Submission id already in use by a different owner, or formVersionId is not the published version',
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/submit/submissions/{id}/save',
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: {
      params: SubmissionIdParamsSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: SubmissionDataBodySchema } },
      },
    },
    responses: {
      200: {
        description:
          'The submission plus the revision this save produced. `revision.status` is `current` when it became the draft, or `pending` when it was held for review (a conflict or a save against a submitted record).',
        content: { 'application/json': { schema: SubmissionWriteResponseSchema } },
      },
      401: { description: SUBMISSION_AUTH_REQUIRED },
      403: {
        description: `${WRITE_AUTHZ}, or the form does not accept drafts (not enabled, or a public audience)`,
      },
      404: { description: SUBMISSION_NOT_FOUND },
      400: { description: INVALID_WRITE_BODY },
      409: { description: WRITE_CONFLICT },
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${SUBMISSION_PATH}/submit`,
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: {
      params: SubmissionIdParamsSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: SubmitSubmissionBodySchema } },
      },
    },
    responses: {
      200: {
        description:
          'The submission plus the revision this submit produced. `revision.status` is `current` when it submitted the record, or `pending` when it was held for review (a conflict or a submit against an already-submitted record).',
        content: { 'application/json': { schema: SubmissionWriteResponseSchema } },
      },
      401: { description: SUBMISSION_AUTH_REQUIRED },
      403: { description: WRITE_AUTHZ },
      404: { description: SUBMISSION_NOT_FOUND },
      400: { description: INVALID_WRITE_BODY },
      409: { description: WRITE_CONFLICT },
    },
  });

  registry.registerPath({
    method: 'get',
    path: SUBMISSION_PATH,
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: { params: SubmissionIdParamsSchema },
    responses: {
      200: {
        description: 'Submission confirmation',
        content: { 'application/json': { schema: SubmissionResponseSchema } },
      },
      401: { description: SUBMISSION_AUTH_REQUIRED },
      403: { description: NOT_PARTICIPANT },
      404: { description: SUBMISSION_NOT_FOUND },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${SUBMISSION_PATH}/data`,
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: { params: SubmissionIdParamsSchema },
    responses: {
      200: {
        description: 'Submission answer document',
        content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } },
      },
      401: { description: SUBMISSION_AUTH_REQUIRED },
      403: { description: NOT_PARTICIPANT },
      404: { description: 'Submission or its content not found' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/submit/submissions/mine',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    description: `The caller's draft and submitted submissions, across every workspace. Anonymous callers have none. ${OFFSET_DRIFT_NOTE}`,
    request: { query: ListMySubmissionsQuerySchema },
    responses: {
      200: {
        description: "A page of the caller's submissions",
        content: { 'application/json': { schema: ListMySubmissionsResponseSchema } },
      },
      400: { description: INVALID_QUERY },
      401: { description: SIGNED_IN_REQUIRED },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/submit/forms/mine',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    description: `Forms the caller holds the submitter role on, and forms they have a draft or submitted submission on, across every workspace. Each row carries the facts the access rules in @soba/lib read (canStartSubmission, canSaveSubmissionDraft); the server enforces the same rules. ${OFFSET_DRIFT_NOTE}`,
    request: { query: ListMyFormsQuerySchema },
    responses: {
      200: {
        description: "A page of the caller's forms",
        content: { 'application/json': { schema: ListMyFormsResponseSchema } },
      },
      400: { description: INVALID_QUERY },
      401: { description: SIGNED_IN_REQUIRED },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/submit/workspaces/mine',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    description: `The workspaces the caller's forms belong to, in name order. Returns at most ${MAX_LOOKUP_LIMIT}; \`truncated\` is true when there are more.`,
    request: { query: MyWorkspaceLookupQuerySchema },
    responses: {
      200: {
        description: "The caller's workspaces",
        content: { 'application/json': { schema: MyWorkspaceLookupResponseSchema } },
      },
      400: { description: INVALID_QUERY },
      401: { description: SIGNED_IN_REQUIRED },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: SUBMISSION_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    description:
      "Deletes the caller's own submission before it is submitted. Anonymous callers cannot delete.",
    request: { params: SubmissionIdParamsSchema },
    responses: {
      204: { description: 'Submission deleted' },
      401: { description: SIGNED_IN_REQUIRED },
      403: { description: 'Not the owner of this submission' },
      404: { description: SUBMISSION_NOT_FOUND },
      409: { description: 'The submission is submitted and can no longer be deleted' },
    },
  });
};
