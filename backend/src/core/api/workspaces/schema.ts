import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  WorkspaceItemSchema as SobaWorkspaceItemSchema,
  CreateWorkspaceBodySchema as SobaCreateWorkspaceBodySchema,
  UpdateWorkspaceBodySchema as SobaUpdateWorkspaceBodySchema,
  WorkspaceSortSchema as SobaWorkspaceSortSchema,
  ListWorkspacesResponseSchema as SobaListWorkspacesResponseSchema,
} from '@soba/lib';

import {
  offsetQueryFields,
  rejectedCursorField,
  searchQueryField,
  OffsetPageSchema,
  OFFSET_DRIFT_NOTE,
} from '../shared/offsetPagination';
import { WORKSPACE_NAME_TAKEN } from '../../messages';

extendZodWithOpenApi(z);

// @soba/lib builds its schemas before zod is extended, so they only get `.openapi()` once cloned.
// Composites are rebuilt on the named children so the spec references them instead of inlining.
export const WorkspaceItemSchema = SobaWorkspaceItemSchema.clone().openapi(
  'Workspaces_WorkspaceItem',
);

export const WorkspaceSortSchema = SobaWorkspaceSortSchema.clone().openapi(
  'Workspaces_WorkspaceSort',
  { description: 'Valid workspace sort tokens: `field:asc` or `field:desc`.' },
);

export const ListWorkspacesQuerySchema = z
  .object({
    ...offsetQueryFields,
    cursor: rejectedCursorField,
    kind: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    q: searchQueryField.openapi({
      description: 'Matches anywhere in the workspace name or organization.',
    }),
    requiredPermission: z.string().trim().min(1).optional(),
    sort: WorkspaceSortSchema.default('name:asc'),
  })
  .openapi('Workspaces_ListWorkspacesQuery');

export const ListWorkspacesResponseSchema = SobaListWorkspacesResponseSchema.extend({
  items: z.array(WorkspaceItemSchema),
  page: OffsetPageSchema,
  sort: WorkspaceSortSchema,
}).openapi('Workspaces_ListWorkspacesResponse');

export const CurrentWorkspaceResponseSchema = WorkspaceItemSchema.openapi(
  'Workspaces_CurrentWorkspaceResponse',
);

export const WorkspaceIdParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('Workspaces_WorkspaceIdParams');

export const CreateWorkspaceBodySchema = SobaCreateWorkspaceBodySchema.clone().openapi(
  'Workspaces_CreateWorkspaceBody',
);

export const UpdateWorkspaceBodySchema = SobaUpdateWorkspaceBodySchema.clone().openapi(
  'Workspaces_UpdateWorkspaceBody',
);

const TAG = 'core.workspaces';
const WORKSPACES_PATH = '/workspaces';
const WORKSPACE_PATH = `${WORKSPACES_PATH}/{id}`;

export const registerWorkspacesOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: WORKSPACES_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      query: ListWorkspacesQuerySchema,
    },
    responses: {
      200: {
        description: `List workspaces for the current user with search and offset pagination. ${OFFSET_DRIFT_NOTE}`,
        content: {
          'application/json': {
            schema: ListWorkspacesResponseSchema,
          },
        },
      },
      400: { description: 'Invalid query' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: WORKSPACE_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: WorkspaceIdParamsSchema,
    },
    responses: {
      200: {
        description: 'Select a workspace by id (verifies membership)',
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
    path: WORKSPACES_PATH,
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
      409: { description: WORKSPACE_NAME_TAKEN },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: WORKSPACE_PATH,
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
      409: { description: WORKSPACE_NAME_TAKEN },
    },
  });
};
