import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const HealthLivenessResponseSchema = z
  .object({
    status: z.literal('OK'),
    timestamp: z.string(),
  })
  .openapi('Health_LivenessResponse');

export const FormEngineReadinessResultSchema = z
  .object({
    ok: z.boolean(),
    message: z.string().optional(),
  })
  .openapi('Health_FormEngineReadinessResult');

export const HealthReadinessResponseSchema = z
  .object({
    status: z.enum(['ready', 'unhealthy']),
    db: z.enum(['ok', 'unreachable']),
    formEngines: z.record(z.string(), FormEngineReadinessResultSchema),
  })
  .openapi('Health_ReadinessResponse');

export const registerHealthOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/health',
    tags: ['core.health'],
    responses: {
      200: {
        description: 'Liveness probe',
        content: {
          'application/json': {
            schema: HealthLivenessResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/health/ready',
    tags: ['core.health'],
    responses: {
      200: {
        description: 'Readiness probe (DB and form engines OK)',
        content: {
          'application/json': {
            schema: HealthReadinessResponseSchema,
          },
        },
      },
      503: {
        description: 'Readiness probe failed (DB or form engine unreachable)',
        content: {
          'application/json': {
            schema: HealthReadinessResponseSchema,
          },
        },
      },
    },
  });
};
