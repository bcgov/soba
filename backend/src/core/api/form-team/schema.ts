import { extendZodWithOpenApi, type OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { TeamGroupSchema, TeamMemberSchema, TeamCandidateSchema, makeSortEnum } from '@soba/lib';
import {
  offsetQueryFields,
  rejectedCursorField,
  searchQueryField,
  sortLocaleQueryField,
  OffsetPageSchema,
} from '../shared/offsetPagination';

import { FORM_TEAM_SORT_FIELDS } from '../../db/repos/formTeamRepo';

extendZodWithOpenApi(z);
export const FormTeamSortSchema = makeSortEnum(FORM_TEAM_SORT_FIELDS);
export const FormTeamParamsSchema = z.object({ id: z.string().uuid() });
export const FormTeamMemberParamsSchema = FormTeamParamsSchema.extend({
  userId: z.string().uuid(),
});
export const ListFormTeamQuerySchema = z.object({
  ...offsetQueryFields,
  cursor: rejectedCursorField,
  q: searchQueryField,
  sort: FormTeamSortSchema.default('name:asc'),
  locale: sortLocaleQueryField,
});
export const SetFormTeamGroupsBodySchema = z
  .object({ groups: z.array(z.string().uuid()).min(1).max(100) })
  .strict();
export const AddFormTeamMemberBodySchema = SetFormTeamGroupsBodySchema.extend({
  membershipId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
})
  .strict()
  .refine((value) => !!value.membershipId !== !!value.userId, {
    message: 'Provide either membershipId or userId',
  });
export type ListFormTeamQuery = z.infer<typeof ListFormTeamQuerySchema>;
export type AddFormTeamMemberInput = z.infer<typeof AddFormTeamMemberBodySchema>;
export const ListFormTeamCandidatesResponseSchema = z.object({
  items: z.array(TeamCandidateSchema),
  page: OffsetPageSchema,
});
export const ListFormTeamResponseSchema = z.object({
  items: z.array(TeamMemberSchema),
  page: OffsetPageSchema,
});

export function registerFormTeamOpenApi(registry: OpenAPIRegistry) {
  const base = '/design/forms/{id}/team';
  const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
  for (const spec of [
    {
      method: 'get' as const,
      path: base,
      params: FormTeamParamsSchema,
      query: ListFormTeamQuerySchema,
      response: ListFormTeamResponseSchema,
    },
    {
      method: 'get' as const,
      path: `${base}/groups`,
      params: FormTeamParamsSchema,
      response: z.object({ items: z.array(TeamGroupSchema) }),
    },
    {
      method: 'get' as const,
      path: `${base}/candidates`,
      params: FormTeamParamsSchema,
      query: ListFormTeamQuerySchema,
      response: ListFormTeamCandidatesResponseSchema,
    },
    {
      method: 'post' as const,
      path: base,
      params: FormTeamParamsSchema,
      body: AddFormTeamMemberBodySchema,
      response: TeamMemberSchema,
    },
    {
      method: 'put' as const,
      path: `${base}/{userId}/groups`,
      params: FormTeamMemberParamsSchema,
      body: SetFormTeamGroupsBodySchema,
      response: TeamMemberSchema,
    },
    { method: 'delete' as const, path: `${base}/{userId}`, params: FormTeamMemberParamsSchema },
  ]) {
    registry.registerPath({
      method: spec.method,
      path: spec.path,
      tags: ['core.form-team'],
      security: [{ bearerAuth: [] }],
      request: {
        params: spec.params,
        ...('query' in spec ? { query: spec.query } : {}),
        ...('body' in spec ? { body: json(spec.body) } : {}),
      },
      responses: {
        ...('response' in spec
          ? { 200: { description: 'Form team', ...json(spec.response) } }
          : { 204: { description: 'Member removed from the form only' } }),
        400: { description: 'Invalid groups, inactive user or inactive workspace membership' },
        403: { description: 'Requires team_update on the form' },
        404: { description: 'Form or member not found' },
        409: { description: 'Duplicate member or last form administrator' },
      },
    });
  }
}
