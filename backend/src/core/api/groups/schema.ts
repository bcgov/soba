import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const RoleCodesSchema = z.array(z.string().trim().min(1)).max(20);

export const WorkspaceGroupParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('Groups_WorkspaceGroupParams');

export const GroupIdParamsSchema = z
  .object({
    id: z.string().min(1),
    groupId: z.string().min(1),
  })
  .openapi('Groups_GroupIdParams');

export const GroupMemberParamsSchema = z
  .object({
    id: z.string().min(1),
    groupId: z.string().min(1),
    memberId: z.string().min(1),
  })
  .openapi('Groups_GroupMemberParams');

export const CreateGroupBodySchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    roleCodes: RoleCodesSchema.default([]),
  })
  .openapi('Groups_CreateGroupBody');

export const UpdateGroupBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).nullable().optional(),
  })
  .refine((body) => body.name !== undefined || body.description !== undefined, {
    message: 'Provide a name or description to update',
  })
  .openapi('Groups_UpdateGroupBody');

export const SetGroupRolesBodySchema = z
  .object({
    roleCodes: RoleCodesSchema,
  })
  .openapi('Groups_SetGroupRolesBody');

export const AddGroupMemberBodySchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('user'), membershipId: z.string().min(1) }),
    z.object({ kind: z.literal('idp'), code: z.string().trim().min(1) }),
  ])
  .openapi('Groups_AddGroupMemberBody');

export const GroupMemberSchema = z
  .discriminatedUnion('kind', [
    z.object({
      id: z.string(),
      kind: z.literal('user'),
      membershipId: z.string(),
      userId: z.string(),
      displayLabel: z.string().nullable(),
    }),
    z.object({
      id: z.string(),
      kind: z.literal('idp'),
      code: z.string(),
      label: z.string(),
    }),
  ])
  .openapi('Groups_GroupMember');

export const GroupSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    /** True for the two protected bootstrap groups (can't be deleted; roles can't change). */
    system: z.boolean(),
    roles: z.array(z.string()),
    members: z.array(GroupMemberSchema),
  })
  .openapi('Groups_Group');

export const ListGroupsResponseSchema = z
  .object({
    items: z.array(GroupSchema),
  })
  .openapi('Groups_ListGroupsResponse');

const TAG = 'core.groups';
const GROUPS_PATH = '/workspaces/{id}/groups';
const GROUP_PATH = '/workspaces/{id}/groups/{groupId}';
const GROUP_ROLES_PATH = '/workspaces/{id}/groups/{groupId}/roles';
const GROUP_MEMBERS_PATH = '/workspaces/{id}/groups/{groupId}/members';
const GROUP_MEMBER_PATH = '/workspaces/{id}/groups/{groupId}/members/{memberId}';

const ERR_MANAGE = 'Workspace management requires an owner or admin role';
const ERR_WORKSPACE_NOT_FOUND = 'Workspace not found';
const ERR_WORKSPACE_OR_GROUP_NOT_FOUND = 'Workspace or group not found';
const OK_UPDATED_GROUP = 'Updated group';
const ERR_NAME_TAKEN = 'A group with this name already exists';

const jsonBody = (schema: z.ZodTypeAny) => ({
  content: { 'application/json': { schema } },
});

const jsonResponse = (description: string, schema: z.ZodTypeAny) => ({
  description,
  content: { 'application/json': { schema } },
});

export const registerGroupsOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: GROUPS_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: { params: WorkspaceGroupParamsSchema },
    responses: {
      200: jsonResponse('Workspace groups with roles and members', ListGroupsResponseSchema),
      403: { description: 'Actor is not a member of the workspace' },
      404: { description: ERR_WORKSPACE_NOT_FOUND },
    },
  });

  registry.registerPath({
    method: 'post',
    path: GROUPS_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: WorkspaceGroupParamsSchema,
      body: jsonBody(CreateGroupBodySchema),
    },
    responses: {
      201: jsonResponse('Group created', GroupSchema),
      400: { description: 'Invalid body or unknown role code' },
      403: { description: ERR_MANAGE },
      404: { description: ERR_WORKSPACE_NOT_FOUND },
      409: { description: ERR_NAME_TAKEN },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: GROUP_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: GroupIdParamsSchema,
      body: jsonBody(UpdateGroupBodySchema),
    },
    responses: {
      200: jsonResponse(OK_UPDATED_GROUP, GroupSchema),
      400: { description: 'Invalid body' },
      403: { description: ERR_MANAGE },
      404: { description: ERR_WORKSPACE_OR_GROUP_NOT_FOUND },
      409: { description: ERR_NAME_TAKEN },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: GROUP_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: { params: GroupIdParamsSchema },
    responses: {
      204: { description: 'Group soft-deleted' },
      403: { description: ERR_MANAGE },
      404: { description: ERR_WORKSPACE_OR_GROUP_NOT_FOUND },
    },
  });

  registry.registerPath({
    method: 'put',
    path: GROUP_ROLES_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: GroupIdParamsSchema,
      body: jsonBody(SetGroupRolesBodySchema),
    },
    responses: {
      200: jsonResponse(OK_UPDATED_GROUP, GroupSchema),
      400: { description: 'Invalid body or unknown role code' },
      403: { description: ERR_MANAGE },
      404: { description: ERR_WORKSPACE_OR_GROUP_NOT_FOUND },
    },
  });

  registry.registerPath({
    method: 'post',
    path: GROUP_MEMBERS_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: GroupIdParamsSchema,
      body: jsonBody(AddGroupMemberBodySchema),
    },
    responses: {
      200: jsonResponse(OK_UPDATED_GROUP, GroupSchema),
      400: { description: 'Invalid member (bad membership, provider, or provider not assignable)' },
      403: { description: ERR_MANAGE },
      404: { description: ERR_WORKSPACE_OR_GROUP_NOT_FOUND },
      409: { description: 'Member already present, or conflicts with public-access exclusivity' },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: GROUP_MEMBER_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: { params: GroupMemberParamsSchema },
    responses: {
      200: jsonResponse(OK_UPDATED_GROUP, GroupSchema),
      403: { description: ERR_MANAGE },
      404: { description: 'Workspace, group, or member not found' },
    },
  });
};
