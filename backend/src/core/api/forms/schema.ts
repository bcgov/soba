import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { CursorSortSchema } from '../shared/pagination';

extendZodWithOpenApi(z);

export const CreateFormBodySchema = z
  .object({
    slug: z.string().trim().min(1),
    name: z.string().trim().min(1),
    description: z.string().optional(),
    formEngineCode: z.string().trim().min(1).optional(),
  })
  .openapi('Forms_CreateFormBody');

export const CreateFormVersionBodySchema = z
  .object({
    formId: z.string().min(1),
  })
  .openapi('Forms_CreateFormVersionBody');

export const UpdateFormVersionParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('Forms_UpdateFormVersionParams');

export const UpdateFormVersionBodySchema = z
  .object({
    state: z.string().min(1).optional(),
  })
  .openapi('Forms_UpdateFormVersionBody');

export const UpdateFormBodySchema = z
  .object({
    slug: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    description: z.string().nullable().optional(),
    status: z.string().trim().min(1).optional(),
  })
  .openapi('Forms_UpdateFormBody');

export const SaveFormVersionParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('Forms_SaveFormVersionParams');

export const SaveFormVersionBodySchema = z
  .object({
    eventType: z.string().min(1).optional(),
    note: z.string().optional(),
    enqueueProvision: z.boolean().optional(),
  })
  .openapi('Forms_SaveFormVersionBody');

export const ListFormsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
    q: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    sort: CursorSortSchema.default('id:desc'),
  })
  .openapi('Forms_ListFormsQuery');

export const FormListItemSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    status: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Forms_FormListItem');

export const FormResponseSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Forms_FormResponse');

export const ListFormsResponseSchema = z
  .object({
    items: z.array(FormListItemSchema),
    page: z.object({
      limit: z.number().int().min(1),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable(),
      cursorMode: z.enum(['id', 'ts_id']),
    }),
    filters: z.object({
      q: z.string().optional(),
      status: z.string().optional(),
    }),
    sort: CursorSortSchema,
  })
  .openapi('Forms_ListFormsResponse');

export const ListFormVersionsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
    formId: z.string().min(1).optional(),
    state: z.string().trim().min(1).optional(),
    sort: CursorSortSchema.default('id:desc'),
  })
  .openapi('Forms_ListFormVersionsQuery');

export const FormVersionListItemSchema = z
  .object({
    id: z.string(),
    formId: z.string(),
    versionNo: z.number().int(),
    state: z.string(),
    engineSyncStatus: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Forms_FormVersionListItem');

export const FormVersionResponseSchema = z
  .object({
    id: z.string(),
    formId: z.string(),
    versionNo: z.number().int(),
    state: z.string(),
    engineSyncStatus: z.string(),
    currentRevisionNo: z.number().int(),
    publishedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Forms_FormVersionResponse');

export const ListFormVersionsResponseSchema = z
  .object({
    items: z.array(FormVersionListItemSchema),
    page: z.object({
      limit: z.number().int().min(1),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable(),
      cursorMode: z.enum(['id', 'ts_id']),
    }),
    filters: z.object({
      formId: z.string().optional(),
      state: z.string().optional(),
    }),
    sort: CursorSortSchema,
  })
  .openapi('Forms_ListFormVersionsResponse');

export const registerFormsOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/forms',
    tags: ['core.forms'],
    security: [{ bearerAuth: [] }],
    request: {
      query: ListFormsQuerySchema,
    },
    responses: {
      200: {
        description: 'List forms with search and cursor pagination',
        content: {
          'application/json': {
            schema: ListFormsResponseSchema,
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
    path: '/forms/{id}',
    tags: ['core.forms'],
    security: [{ bearerAuth: [] }],
    request: {
      params: UpdateFormVersionParamsSchema,
    },
    responses: {
      200: {
        description: 'Get form by id',
        content: {
          'application/json': {
            schema: FormResponseSchema,
          },
        },
      },
      404: {
        description: 'Form not found',
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/forms',
    tags: ['core.forms'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: CreateFormBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created form',
        content: {
          'application/json': {
            schema: FormResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation or business rule error',
      },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/forms/{id}',
    tags: ['core.forms'],
    security: [{ bearerAuth: [] }],
    request: {
      params: UpdateFormVersionParamsSchema,
      body: {
        required: false,
        content: {
          'application/json': {
            schema: UpdateFormBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated form',
        content: {
          'application/json': {
            schema: FormResponseSchema,
          },
        },
      },
      404: {
        description: 'Form not found',
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/form-versions',
    tags: ['core.forms'],
    security: [{ bearerAuth: [] }],
    request: {
      query: ListFormVersionsQuerySchema,
    },
    responses: {
      200: {
        description: 'List form versions with cursor pagination',
        content: {
          'application/json': {
            schema: ListFormVersionsResponseSchema,
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
    path: '/form-versions/{id}',
    tags: ['core.forms'],
    security: [{ bearerAuth: [] }],
    request: {
      params: UpdateFormVersionParamsSchema,
    },
    responses: {
      200: {
        description: 'Get form version by id',
        content: {
          'application/json': {
            schema: FormVersionResponseSchema,
          },
        },
      },
      404: {
        description: 'Form version not found',
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/form-versions',
    tags: ['core.forms'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: CreateFormVersionBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created form version draft',
        content: { 'application/json': { schema: FormVersionResponseSchema } },
      },
      400: {
        description: 'Validation or business rule error',
      },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/form-versions/{id}',
    tags: ['core.forms'],
    security: [{ bearerAuth: [] }],
    request: {
      params: UpdateFormVersionParamsSchema,
      body: {
        required: false,
        content: {
          'application/json': {
            schema: UpdateFormVersionBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated form version draft',
        content: { 'application/json': { schema: FormVersionResponseSchema } },
      },
      404: {
        description: 'Form version not found',
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/form-versions/{id}/save',
    tags: ['core.forms'],
    security: [{ bearerAuth: [] }],
    request: {
      params: SaveFormVersionParamsSchema,
      body: {
        required: false,
        content: {
          'application/json': {
            schema: SaveFormVersionBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Saved form version draft',
        content: { 'application/json': { schema: FormVersionResponseSchema } },
      },
      400: {
        description: 'Validation or business rule error',
      },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/form-versions/{id}',
    tags: ['core.forms'],
    security: [{ bearerAuth: [] }],
    request: {
      params: UpdateFormVersionParamsSchema,
    },
    responses: {
      204: {
        description: 'Form version marked as deleted',
      },
      404: {
        description: 'Form version not found',
      },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/forms/{id}',
    tags: ['core.forms'],
    security: [{ bearerAuth: [] }],
    request: {
      params: UpdateFormVersionParamsSchema,
    },
    responses: {
      204: {
        description: 'Form marked as deleted',
      },
      404: {
        description: 'Form not found',
      },
    },
  });
};
