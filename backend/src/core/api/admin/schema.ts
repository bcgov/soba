import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const SobaAdminItemSchema = z
  .object({
    userId: z.string(),
    source: z.string(),
    identityProviderCode: z.string().nullable(),
    syncedAt: z.string().nullable(),
    displayLabel: z.string().nullable(),
  })
  .openapi('Admin_SobaAdminItem');

export const ListSobaAdminsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
  })
  .openapi('Admin_ListSobaAdminsQuery');

export const ListSobaAdminsResponseSchema = z
  .object({
    items: z.array(SobaAdminItemSchema),
    page: z.object({
      limit: z.number().int().min(1),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable(),
      cursorMode: z.enum(['id']),
    }),
  })
  .openapi('Admin_ListSobaAdminsResponse');

export const AddSobaAdminBodySchema = z
  .object({
    userId: z.string().uuid(),
  })
  .openapi('Admin_AddSobaAdminBody');

export const SobaAdminUserIdParamsSchema = z
  .object({
    userId: z.string().uuid(),
  })
  .openapi('Admin_SobaAdminUserIdParams');

export const registerAdminOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/admin/soba-admins',
    tags: ['core.admin'],
    security: [{ bearerAuth: [] }],
    request: {
      query: ListSobaAdminsQuerySchema,
    },
    responses: {
      200: {
        description: 'List SOBA platform admins with cursor pagination',
        content: {
          'application/json': {
            schema: ListSobaAdminsResponseSchema,
          },
        },
      },
      400: { description: 'Invalid query or cursor' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/admin/soba-admins',
    tags: ['core.admin'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: AddSobaAdminBodySchema,
          },
        },
      },
    },
    responses: {
      204: { description: 'Direct SOBA admin grant added or converted' },
      400: { description: 'Invalid body (e.g. userId not a UUID)' },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/admin/soba-admins/{userId}',
    tags: ['core.admin'],
    security: [{ bearerAuth: [] }],
    responses: {
      204: { description: 'Direct grant removed (or no-op if not direct)' },
      400: { description: 'Invalid userId' },
    },
  });
};
