import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { CursorSortSchema } from '../shared/pagination';

extendZodWithOpenApi(z);

export const WorkspaceItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string().nullable(),
    kind: z.string(),
    role: z.string(),
    status: z.string(),
  })
  .openapi('Workspaces_WorkspaceItem');

export const ListWorkspacesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
    kind: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    sort: CursorSortSchema.default('id:desc'),
  })
  .openapi('Workspaces_ListWorkspacesQuery');

export const ListWorkspacesResponseSchema = z
  .object({
    items: z.array(WorkspaceItemSchema),
    page: z.object({
      limit: z.number().int().min(1),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable(),
      cursorMode: z.enum(['id', 'ts_id']),
    }),
    filters: z.object({
      kind: z.string().optional(),
      status: z.string().optional(),
    }),
    sort: CursorSortSchema,
  })
  .openapi('Workspaces_ListWorkspacesResponse');

export const CurrentWorkspaceResponseSchema = WorkspaceItemSchema.openapi(
  'Workspaces_CurrentWorkspaceResponse',
);

export const registerWorkspacesOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/workspaces',
    tags: ['core.workspaces'],
    security: [{ bearerAuth: [] }],
    request: {
      query: ListWorkspacesQuerySchema,
    },
    responses: {
      200: {
        description: 'List workspaces for the current user with cursor pagination',
        content: {
          'application/json': {
            schema: ListWorkspacesResponseSchema,
          },
        },
      },
      400: { description: 'Invalid query or cursor' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/workspaces/current',
    tags: ['core.workspaces'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Current workspace from request context',
        content: {
          'application/json': {
            schema: CurrentWorkspaceResponseSchema,
          },
        },
      },
      404: {
        description: 'Current workspace not found',
      },
    },
  });
};
