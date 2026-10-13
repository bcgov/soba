import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import type { Router } from 'express';
import { env } from '../../config/env';
import { ApiErrorSchema } from './schema';

extendZodWithOpenApi(z);

export type RegisterOpenApiPaths = (registry: OpenAPIRegistry) => void;

/** Domain module contract for core API: router mounted at path + OpenAPI registration */
export interface CoreDomain {
  path: string;
  router: Router;
  registerOpenApi: RegisterOpenApiPaths;
}

const openApiPathRegistrars: RegisterOpenApiPaths[] = [];

export const registerOpenApiPaths = (registrar: RegisterOpenApiPaths): void => {
  openApiPathRegistrars.push(registrar);
};

type ResponseLike = { $ref?: string; content?: unknown };

const responsesOf = (document: { paths?: Record<string, unknown> }) =>
  Object.values(document.paths ?? {})
    .flatMap((pathItem) => Object.values(pathItem as Record<string, unknown>))
    .flatMap((operation) =>
      Object.entries((operation as { responses?: Record<string, ResponseLike> }).responses ?? {}),
    );

/** Gives every 4xx and 5xx response that declares no body of its own the shared error body. */
export const withErrorBodies = <T extends { paths?: Record<string, unknown> }>(document: T): T => {
  for (const [status, response] of responsesOf(document)) {
    if (Number(status) >= 400 && !response.$ref && !response.content) {
      response.content = {
        'application/json': { schema: { $ref: '#/components/schemas/Core_ApiError' } },
      };
    }
  }
  return document;
};

/** The spec for the given path registrations, with the shared error body on every error response. */
export const buildOpenApiDocument = (registrars: readonly RegisterOpenApiPaths[]) => {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  registry.register('Core_ApiError', ApiErrorSchema);

  for (const registrar of registrars) {
    registrar(registry);
  }

  const generator = new OpenApiGeneratorV3(registry.definitions);
  const document = generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Soba Backend API',
      version: '1.0.0',
      description: 'Core and plugin APIs for Soba backend.',
    },
    servers: [
      {
        url: `${env.getApiBasePath()}/api/v1`,
        description: 'Core API v1',
      },
    ],
  });
  return withErrorBodies(document);
};

export const buildOpenApiSpec = () => buildOpenApiDocument(openApiPathRegistrars);
