import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { env } from '../../config/env';

extendZodWithOpenApi(z);

const VersionSchema = z.enum(['v2', 'v3']).openapi('DocumentGeneration_Version');

const VersionParamsSchema = z
  .object({
    version: VersionSchema,
  })
  .openapi('DocumentGeneration_VersionParams');

const VersionHashParamsSchema = z
  .object({
    version: VersionSchema,
    hash: z.string().min(1),
  })
  .openapi('DocumentGeneration_VersionHashParams');

const ErrorResponseSchema = z
  .object({
    error: z.string(),
  })
  .openapi('DocumentGeneration_ErrorResponse');

const JsonPayloadSchema = z
  .record(z.string(), z.unknown())
  .openapi('DocumentGeneration_JsonPayload');

const TAG = 'core.document-generation';

export const registerDocumentGenerationOpenApi = (registry: OpenAPIRegistry): void => {
  if (!env.getOptionalEnv('PLUGIN_CDOGS_BASE_URL')) {
    return;
  }

  registry.registerPath({
    method: 'post',
    path: '/document-generation/{version}/template',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: VersionParamsSchema,
    },
    responses: {
      200: { description: 'Template uploaded' },
      201: { description: 'Template uploaded' },
      400: {
        description: 'Validation error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      500: {
        description: 'Server error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/document-generation/{version}/template/render',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: VersionParamsSchema,
      body: {
        description: 'Render payload',
        content: { 'application/json': { schema: JsonPayloadSchema } },
      },
    },
    responses: {
      200: { description: 'Rendered document' },
      400: {
        description: 'Validation error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      500: {
        description: 'Server error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/document-generation/{version}/template/{hash}/render',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: VersionHashParamsSchema,
      body: {
        description: 'Render payload',
        content: { 'application/json': { schema: JsonPayloadSchema } },
      },
    },
    responses: {
      200: { description: 'Rendered document' },
      400: {
        description: 'Validation error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      500: {
        description: 'Server error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/document-generation/{version}/template/{hash}',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: VersionHashParamsSchema,
    },
    responses: {
      200: { description: 'Template retrieved' },
      400: {
        description: 'Validation error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      404: {
        description: 'Template not found',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      500: {
        description: 'Server error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/document-generation/{version}/template/{hash}',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: VersionHashParamsSchema,
    },
    responses: {
      200: { description: 'Template deleted' },
      204: { description: 'Template deleted' },
      400: {
        description: 'Validation error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      500: {
        description: 'Server error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/document-generation/{version}/file-types',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: VersionParamsSchema,
    },
    responses: {
      200: { description: 'Supported output file types' },
      400: {
        description: 'Validation error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      500: {
        description: 'Server error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/document-generation/{version}/health',
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: VersionParamsSchema,
    },
    responses: {
      200: { description: 'CDOGS health status' },
      400: {
        description: 'Validation error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      500: {
        description: 'Server error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });
};
