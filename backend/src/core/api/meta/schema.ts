import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const PluginCatalogEntrySchema = z
  .object({
    code: z.string(),
    enabled: z.boolean(),
    hasWorkspaceResolver: z.boolean(),
    hasApi: z.boolean(),
    apiBasePath: z.string().optional(),
  })
  .openapi('Meta_PluginCatalogEntry');

export const PluginsMetaResponseSchema = z
  .object({
    enabledPluginCodes: z.array(z.string()),
    plugins: z.array(PluginCatalogEntrySchema),
  })
  .openapi('Meta_PluginsResponse');

export const FeaturesMetaResponseSchema = z
  .object({
    coreFeatures: z.array(z.string()),
    pluginFeatures: z.array(
      z
        .object({
          code: z.string(),
          apiBasePath: z.string(),
          enabled: z.boolean(),
        })
        .openapi('Meta_PluginFeature'),
    ),
    activeCache: z.object({ code: z.string() }).openapi('Meta_ActiveCache'),
    activeMessageBus: z.object({ code: z.string() }).openapi('Meta_ActiveMessageBus'),
    activeFormEngine: z.object({ code: z.string() }).openapi('Meta_ActiveFormEngine'),
  })
  .openapi('Meta_FeaturesResponse');

export const BuildMetaResponseSchema = z
  .object({
    name: z.string(),
    version: z.string(),
    nodeVersion: z.string(),
    formioVersion: z.string(),
    gitSha: z.string(),
    gitTag: z.string(),
    imageTag: z.string(),
  })
  .openapi('Meta_BuildResponse');

export const FormEngineMetaSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    engineVersion: z.string().nullable(),
    isActive: z.boolean(),
    isDefault: z.boolean(),
    installedPlugin: z.boolean(),
  })
  .openapi('Meta_FormEngine');

export const FormEnginesMetaResponseSchema = z
  .object({
    items: z.array(FormEngineMetaSchema),
  })
  .openapi('Meta_FormEnginesResponse');

export const registerMetaOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/meta/plugins',
    tags: ['core.meta'],
    responses: {
      200: {
        description: 'Enabled and discovered plugin catalog',
        content: {
          'application/json': {
            schema: PluginsMetaResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/meta/features',
    tags: ['core.meta'],
    responses: {
      200: {
        description: 'Core and plugin feature catalog',
        content: {
          'application/json': {
            schema: FeaturesMetaResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/meta/form-engines',
    tags: ['core.meta'],
    responses: {
      200: {
        description: 'Configured platform form engines and plugin installation status',
        content: {
          'application/json': {
            schema: FormEnginesMetaResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/meta/build',
    tags: ['core.meta'],
    responses: {
      200: {
        description: 'Build metadata (version and deployment identifiers)',
        content: {
          'application/json': {
            schema: BuildMetaResponseSchema,
          },
        },
      },
    },
  });
};
