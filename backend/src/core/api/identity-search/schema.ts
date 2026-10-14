import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  IdirUserSchema as LibUser,
  IdirUserSearchQuerySchema as LibSearch,
  IdirUserSearchResponseSchema as LibResponse,
} from '@soba/lib';
extendZodWithOpenApi(z);
export const IdirUserSchema = LibUser.clone().openapi('IdentitySearch_IdirUser');
export const IdirUserSearchQuerySchema = LibSearch.clone().openapi(
  'IdentitySearch_IdirSearchQuery',
);
export const IdirUserSearchResponseSchema = LibResponse.extend({
  users: z.array(IdirUserSchema),
}).openapi('IdentitySearch_IdirSearchResponse');
export function registerIdentitySearchOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/identity-search/idir',
    tags: ['core.identity-search'],
    security: [{ bearerAuth: [] }],
    request: { query: IdirUserSearchQuerySchema },
    responses: {
      200: {
        description: 'Matching IDIR users',
        content: { 'application/json': { schema: IdirUserSearchResponseSchema } },
      },
      400: { description: 'Provide workspaceId and at least one valid search field' },
      403: { description: 'Workspace owner or admin membership required' },
      503: { description: 'User directory unavailable' },
    },
  });
}
