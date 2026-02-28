import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { Router } from 'express';
import { PluginConfigReader } from '../../config/pluginConfig';

export interface FeatureApiDefinition {
  readonly code: string;
  readonly basePath: string;
  createRouter(config: PluginConfigReader): Router;
  registerOpenApi?(registry: OpenAPIRegistry): void;
}
