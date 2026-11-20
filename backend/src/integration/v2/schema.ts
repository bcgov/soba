import { extendZodWithOpenApi, type OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { ApiErrorSchema } from '../../core/api/shared/schema';
import { HealthLivenessResponseSchema } from '../../core/api/health/schema';

extendZodWithOpenApi(z);

export const IntegrationCredentialSchema = z
  .object({
    id: z.uuid(),
    clientId: z.string(),
    workspaceId: z.uuid(),
    formId: z.uuid().nullable(),
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

// Consumers reach every operation through the gateway, which requires an API key on all of them.
const gatewayAclDenied = {
  description: 'Gateway ACL denies access to this Product Environment',
  content: { 'application/json': { schema: GatewayErrorSchema } },
};

export const registerIntegrationV2OpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/health',
    security: [{ apiKey: [] }],
    summary: 'Integration API liveness; does not check dependencies',
    description:
      'The gateway requires an API key and ACL approval. The backend verifies the gateway JWT it adds; gatewayAuthenticated is then true.',
    responses: {
      200: {
        description: 'Alive',
        content: { 'application/json': { schema: IntegrationHealthResponseSchema } },
      },
      401: {
        description: 'Gateway API-key rejection or invalid gateway JWT',
        content: { 'application/json': { schema: z.union([ApiErrorSchema, GatewayErrorSchema]) } },
      },
      403: gatewayAclDenied,
      503: { description: 'A gateway JWT was supplied but verification is not configured' },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/me',
    security: [{ apiKey: [] }],
    summary: 'Inspect the active API credential and redacted incoming request',
    description: 'Secrets are redacted and the response is not cached.',
    responses: {
      200: {
        description: 'Resolved identity',
        content: { 'application/json': { schema: IntegrationMeResponseSchema } },
      },
      401: {
        description: 'Gateway API-key rejection, invalid upstream JWT or inactive API credential',
        content: { 'application/json': { schema: z.union([ApiErrorSchema, GatewayErrorSchema]) } },
      },
      403: gatewayAclDenied,
      503: { description: 'Gateway authentication is not configured' },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/openapi.json',
    security: [{ apiKey: [] }],
    summary: 'Integration API v2 OpenAPI document',
    description:
      'The gateway requires an API key and ACL approval. The same document is published without a key at /api/docs/integrations/v2/openapi.json on the main API.',
    responses: {
      200: { description: 'OpenAPI 3.0 document' },
      401: {
        description: 'Gateway API-key rejection',
        content: { 'application/json': { schema: GatewayErrorSchema } },
      },
      403: gatewayAclDenied,
    },
  });
};
