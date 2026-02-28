import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { CursorSortSchema } from '../shared/pagination';

extendZodWithOpenApi(z);

export const CreateSubmissionBodySchema = z
  .object({
    formId: z.string().min(1),
    formVersionId: z.string().min(1),
  })
  .openapi('Submissions_CreateSubmissionBody');

export const UpdateSubmissionParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('Submissions_UpdateSubmissionParams');

export const UpdateSubmissionBodySchema = z
  .object({
    workflowState: z.string().min(1).optional(),
  })
  .openapi('Submissions_UpdateSubmissionBody');

export const SaveSubmissionParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('Submissions_SaveSubmissionParams');

export const SaveSubmissionBodySchema = z
  .object({
    eventType: z.string().min(1).optional(),
    note: z.string().optional(),
    enqueueProvision: z.boolean().optional(),
  })
  .openapi('Submissions_SaveSubmissionBody');

export const ListSubmissionsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
    formId: z.string().min(1).optional(),
    formVersionId: z.string().min(1).optional(),
    workflowState: z.string().trim().min(1).optional(),
    sort: CursorSortSchema.default('id:desc'),
  })
  .openapi('Submissions_ListSubmissionsQuery');

export const SubmissionListItemSchema = z
  .object({
    id: z.string(),
    formId: z.string(),
    formVersionId: z.string(),
    workflowState: z.string(),
    engineSyncStatus: z.string(),
    submittedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Submissions_SubmissionListItem');

export const SubmissionResponseSchema = z
  .object({
    id: z.string(),
    formId: z.string(),
    formVersionId: z.string(),
    workflowState: z.string(),
    engineSyncStatus: z.string(),
    currentRevisionNo: z.number().int(),
    submittedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Submissions_SubmissionResponse');

export const ListSubmissionsResponseSchema = z
  .object({
    items: z.array(SubmissionListItemSchema),
    page: z.object({
      limit: z.number().int().min(1),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable(),
      cursorMode: z.enum(['id', 'ts_id']),
    }),
    filters: z.object({
      formId: z.string().optional(),
      formVersionId: z.string().optional(),
      workflowState: z.string().optional(),
    }),
    sort: CursorSortSchema,
  })
  .openapi('Submissions_ListSubmissionsResponse');

export const registerSubmissionsOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/submissions',
    tags: ['core.submissions'],
    security: [{ bearerAuth: [] }],
    request: {
      query: ListSubmissionsQuerySchema,
    },
    responses: {
      200: {
        description: 'List submissions with cursor pagination',
        content: {
          'application/json': {
            schema: ListSubmissionsResponseSchema,
          },
        },
      },
      400: {
        description: 'Invalid query or cursor',
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/submissions/{id}',
    tags: ['core.submissions'],
    security: [{ bearerAuth: [] }],
    request: {
      params: UpdateSubmissionParamsSchema,
    },
    responses: {
      200: {
        description: 'Get submission by id',
        content: { 'application/json': { schema: SubmissionResponseSchema } },
      },
      404: {
        description: 'Submission not found',
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/submissions',
    tags: ['core.submissions'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: CreateSubmissionBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created submission draft',
        content: { 'application/json': { schema: SubmissionResponseSchema } },
      },
      400: {
        description: 'Validation or business rule error',
      },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/submissions/{id}',
    tags: ['core.submissions'],
    security: [{ bearerAuth: [] }],
    request: {
      params: UpdateSubmissionParamsSchema,
      body: {
        required: false,
        content: {
          'application/json': {
            schema: UpdateSubmissionBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated submission draft',
        content: { 'application/json': { schema: SubmissionResponseSchema } },
      },
      404: {
        description: 'Submission not found',
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/submissions/{id}/save',
    tags: ['core.submissions'],
    security: [{ bearerAuth: [] }],
    request: {
      params: SaveSubmissionParamsSchema,
      body: {
        required: false,
        content: {
          'application/json': {
            schema: SaveSubmissionBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Saved submission draft',
        content: { 'application/json': { schema: SubmissionResponseSchema } },
      },
      400: {
        description: 'Validation or business rule error',
      },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/submissions/{id}',
    tags: ['core.submissions'],
    security: [{ bearerAuth: [] }],
    request: {
      params: UpdateSubmissionParamsSchema,
    },
    responses: {
      204: {
        description: 'Submission marked as deleted',
      },
      404: {
        description: 'Submission not found',
      },
    },
  });
};
