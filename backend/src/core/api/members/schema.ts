import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { CursorSortSchema } from '../shared/pagination';

extendZodWithOpenApi(z);

export const MemberItemSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    displayLabel: z.string().nullable(),
    role: z.string(),
    status: z.string(),
  })
  .openapi('Members_MemberItem');

export const ListMembersQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
    role: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    sort: CursorSortSchema.default('id:desc'),
  })
  .openapi('Members_ListMembersQuery');

export const ListMembersResponseSchema = z
  .object({
    items: z.array(MemberItemSchema),
    page: z.object({
      limit: z.number().int().min(1),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable(),
      cursorMode: z.enum(['id', 'ts_id']),
    }),
    filters: z.object({
      role: z.string().optional(),
      status: z.string().optional(),
    }),
    sort: CursorSortSchema,
  })
  .openapi('Members_ListMembersResponse');

export const registerMembersOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/members',
    tags: ['core.members'],
    security: [{ bearerAuth: [] }],
    request: {
      query: ListMembersQuerySchema,
    },
    responses: {
      200: {
        description: 'List members of the current workspace with cursor pagination',
        content: {
          'application/json': {
            schema: ListMembersResponseSchema,
          },
        },
      },
      400: { description: 'Invalid query or cursor' },
    },
  });
};
