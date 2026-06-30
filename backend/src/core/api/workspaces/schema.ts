import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { CursorSortSchema } from '../shared/pagination';
import { WorkspaceScopedQuerySchema } from '../shared/schema';

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

export const WorkspaceIdParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('Workspaces_WorkspaceIdParams');

export const CreateWorkspaceBodySchema = z
  .object({
    name: z.string().trim().min(1),
  })
  .openapi('Workspaces_CreateWorkspaceBody');

export const UpdateWorkspaceBodySchema = z
  .object({
    name: z.string().trim().min(1),
  })
  .openapi('Workspaces_UpdateWorkspaceBody');

const TAG = 'core.workspaces';

export const registerWorkspacesOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/workspaces',
    tags: [TAG],
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
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      query: WorkspaceScopedQuerySchema,
    },
    responses: {
      200: {
        description: 'Current workspace resolved from the workspaceId query parameter',
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

  registry.registerPath({
    method: 'get',
    path: '/workspaces/{id}',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: WorkspaceIdParamsSchema,
    },
    responses: {
      200: {
        description:
          'Select a workspace by id (verifies membership; echoes x-soba-workspace-id response header)',
        content: {
          'application/json': {
            schema: CurrentWorkspaceResponseSchema,
          },
        },
      },
      403: { description: 'Actor is not a member of the workspace' },
      404: { description: 'Workspace not found' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/workspaces',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateWorkspaceBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Workspace created',
        content: {
          'application/json': {
            schema: WorkspaceItemSchema,
          },
        },
      },
      400: { description: 'Invalid body' },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/workspaces/{id}',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: WorkspaceIdParamsSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateWorkspaceBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Workspace updated',
        content: {
          'application/json': {
            schema: WorkspaceItemSchema,
          },
        },
      },
      403: { description: 'Only workspace owners can rename this workspace' },
      404: { description: 'Workspace not found' },
    },
  });
};
