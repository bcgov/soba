import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export const PersonalLocalInfoResponseSchema = z.object({
  code: z.literal('personal-local'),
  mode: z.literal('personal'),
  cookieKey: z.string(),
  allowHeaderOverride: z.boolean(),
});

export const registerPersonalLocalInfoOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/api/plugins/personal-local/info',
    tags: ['plugin.personal-local'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Personal local plugin API metadata',
        content: {
          'application/json': {
            schema: PersonalLocalInfoResponseSchema,
          },
        },
      },
    },
  });
};
