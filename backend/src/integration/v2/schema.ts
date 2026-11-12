import { extendZodWithOpenApi, type OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { CredentialPermissionSchema } from '@soba/lib';
import { ApiErrorSchema } from '../../core/api/shared/schema';
import { HealthLivenessResponseSchema } from '../../core/api/health/schema';

extendZodWithOpenApi(z);

export const IntegrationCredentialSchema = z
  .object({
    id: z.uuid(),
    clientId: z.string(),
    workspaceId: z.uuid(),
    formId: z.uuid().nullable(),
    permissions: z.array(CredentialPermissionSchema),
  })
  .openapi('IntegrationV2_Credential');

export const IntegrationMeResponseSchema = z
  .object({
    credential: IntegrationCredentialSchema,
    method: z.string(),
    path: z.string(),
    ip: z.string().optional(),
    headers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  })
  .openapi('IntegrationV2_MeResponse');

// Gateway failures have their own body; do not describe them as backend Core_ApiError responses.
const GatewayErrorSchema = z.object({ message: z.string() }).openapi('IntegrationV2_GatewayError');

export const IntegrationHealthResponseSchema = HealthLivenessResponseSchema.extend({
  gatewayAuthenticated: z.literal(true).optional(),
}).openapi('IntegrationV2_HealthResponse');

export const registerIntegrationV2OpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/health',
    security: [],
    summary: 'Integration API liveness; does not check dependencies',
    description:
      'Direct backend probes are public. The protected gateway requires an API key and ACL approval. A supplied upstream JWT is verified; gatewayAuthenticated is then true.',
    responses: {
      200: {
        description: 'Alive',
        content: { 'application/json': { schema: IntegrationHealthResponseSchema } },
      },
      401: { description: 'Invalid supplied gateway JWT, or gateway key authentication failed' },
      503: { description: 'A gateway JWT was supplied but verification is not configured' },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/me',
    security: [{ apiKey: [] }],
    summary: 'Inspect the active API credential and redacted incoming request',
    description:
      'Grants are configured permissions, not proof of access to a specific resource. Form/workspace authorization is required separately. Secrets are redacted and the response is not cached.',
    responses: {
      200: {
        description: 'Resolved identity',
        content: { 'application/json': { schema: IntegrationMeResponseSchema } },
      },
      401: {
        description: 'Gateway API-key rejection, invalid upstream JWT or inactive API credential',
        content: { 'application/json': { schema: z.union([ApiErrorSchema, GatewayErrorSchema]) } },
      },
      403: {
        description: 'Gateway ACL denies access to this Product Environment',
        content: { 'application/json': { schema: GatewayErrorSchema } },
      },
      503: { description: 'Gateway authentication is not configured' },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/openapi.json',
    security: [],
    summary: 'Integration API v2 OpenAPI document',
    responses: { 200: { description: 'OpenAPI 3.0 document' } },
  });
};
