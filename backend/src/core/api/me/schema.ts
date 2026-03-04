import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const MeActorSchema = z
  .object({
    id: z.string(),
    displayLabel: z.string().nullable(),
    status: z.string(),
  })
  .openapi('Me_Actor');

export const MeProfileSchema = z
  .object({
    displayName: z.string().nullable(),
    email: z.string().nullable(),
    preferredUsername: z.string().nullable(),
  })
  .openapi('Me_Profile');

export const MeResponseSchema = z
  .object({
    actor: MeActorSchema,
    profile: MeProfileSchema,
  })
  .openapi('Me_Response');

export const registerMeOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/me',
    tags: ['core.me'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Current authenticated actor with backend-resolved profile fields',
        content: {
          'application/json': {
            schema: MeResponseSchema,
          },
        },
      },
      404: {
        description: 'Current actor not found',
      },
    },
  });
};
