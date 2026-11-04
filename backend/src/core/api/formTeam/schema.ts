import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  AddFormTeamMemberBodySchema as LibAddBodySchema,
  FormTeamGroupsSchema as LibGroupsSchema,
  FormTeamResponseSchema as LibTeamResponseSchema,
  SetFormTeamGroupsBodySchema as LibSetGroupsBodySchema,
  TeamGroupSchema as LibGroupSchema,
  TeamMemberSchema as LibMemberSchema,
} from '@soba/lib';
import { FORM_TEAM_MEMBER_EXISTS, LAST_FORM_ADMIN } from '../../messages';
import {
  offsetQueryFields,
  rejectedCursorField,
  searchQueryField,
  OffsetPageSchema,
  sortLocaleQueryField,
} from '../shared/offsetPagination';

extendZodWithOpenApi(z);

export const FormTeamParamsSchema = z.object({ id: z.string().min(1) }).openapi('FormTeam_Params');

export const FormTeamMemberParamsSchema = z
  .object({ id: z.string().min(1), membershipId: z.string().min(1) })
  .openapi('FormTeam_MemberParams');

export const ListFormTeamQuerySchema = z
  .object({
    ...offsetQueryFields,
    cursor: rejectedCursorField,
    q: searchQueryField.openapi({ description: 'Matches anywhere in a member name or email.' }),
    locale: sortLocaleQueryField,
  })
  .openapi('FormTeam_ListQuery');

export const TeamMemberSchema = LibMemberSchema.clone().openapi('FormTeam_Member');
export const TeamGroupSchema = LibGroupSchema.clone().openapi('FormTeam_Group');
export const FormTeamResponseSchema = LibTeamResponseSchema.extend({
  items: z.array(TeamMemberSchema),
  page: OffsetPageSchema,
}).openapi('FormTeam_Response');
export const FormTeamGroupsSchema = LibGroupsSchema.extend({
  items: z.array(TeamGroupSchema),
}).openapi('FormTeam_Groups');
export const AddFormTeamMemberBodySchema = LibAddBodySchema.clone().openapi('FormTeam_AddBody');
export const SetFormTeamGroupsBodySchema =
  LibSetGroupsBodySchema.clone().openapi('FormTeam_SetGroupsBody');

const TAG = 'core.formTeam';
const TEAM_PATH = '/design/forms/{id}/team';
const MEMBER_PATH = `${TEAM_PATH}/{membershipId}`;
const SECURITY = [{ bearerAuth: [] }];
const NEEDS_READ = 'Needs team_read on the form';
const NEEDS_UPDATE = 'Needs team_update on the form';
const NOT_ON_TEAM = 'Not on the form team';
const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } });

export const registerFormTeamOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: TEAM_PATH,
    tags: [TAG],
    security: SECURITY,
    request: { params: FormTeamParamsSchema, query: ListFormTeamQuerySchema },
    responses: {
      200: {
        description: "The form's team by name: each member with their groups on this form",
        content: json(FormTeamResponseSchema),
      },
      403: { description: NEEDS_READ },
    },
  });
  registry.registerPath({
    method: 'get',
    path: `${TEAM_PATH}/groups`,
    tags: [TAG],
    security: SECURITY,
    request: { params: FormTeamParamsSchema },
    responses: {
      200: {
        description: "The groups a member can be put in: the workspace's active groups",
        content: json(FormTeamGroupsSchema),
      },
      403: { description: NEEDS_READ },
    },
  });
  registry.registerPath({
    method: 'post',
    path: TEAM_PATH,
    tags: [TAG],
    security: SECURITY,
    request: {
      params: FormTeamParamsSchema,
      body: { required: true, content: json(AddFormTeamMemberBodySchema) },
    },
    responses: {
      201: {
        description:
          'The person, on this form only: their groups apply to this form, and someone outside the workspace joins it as a viewer',
        content: json(TeamMemberSchema),
      },
      400: { description: 'Invalid body, an unknown group, or a user who cannot be added' },
      403: { description: NEEDS_UPDATE },
      409: { description: FORM_TEAM_MEMBER_EXISTS },
    },
  });
  registry.registerPath({
    method: 'put',
    path: `${MEMBER_PATH}/groups`,
    tags: [TAG],
    security: SECURITY,
    request: {
      params: FormTeamMemberParamsSchema,
      body: { required: true, content: json(SetFormTeamGroupsBodySchema) },
    },
    responses: {
      200: { description: "The member's groups on this form", content: json(TeamMemberSchema) },
      400: { description: 'Invalid body or an unknown group' },
      403: { description: NEEDS_UPDATE },
      404: { description: NOT_ON_TEAM },
      409: { description: LAST_FORM_ADMIN },
    },
  });
  registry.registerPath({
    method: 'delete',
    path: MEMBER_PATH,
    tags: [TAG],
    security: SECURITY,
    request: { params: FormTeamMemberParamsSchema },
    responses: {
      204: { description: 'Taken out of every group on this form; other forms are unchanged' },
      403: { description: NEEDS_UPDATE },
      404: { description: NOT_ON_TEAM },
      409: { description: LAST_FORM_ADMIN },
    },
  });
};
