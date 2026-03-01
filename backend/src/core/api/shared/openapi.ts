import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import type { Router } from 'express';

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

export const buildOpenApiSpec = () => {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  for (const registrar of openApiPathRegistrars) {
    registrar(registry);
  }

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Soba Backend API',
      version: '1.0.0',
      description: 'Core and plugin APIs for Soba backend.',
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Core API v1',
      },
    ],
  });
};
