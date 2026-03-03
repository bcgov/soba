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

export const FeatureMetaSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    version: z.string().nullable(),
    status: z.string(),
    enabled: z.boolean(),
  })
  .openapi('Meta_Feature');

export const FeaturesMetaResponseSchema = z
  .object({
    features: z.array(FeatureMetaSchema),
  })
  .openapi('Meta_FeaturesResponse');

export const BuildMetaResponseSchema = z
  .object({
    name: z.string(),
    version: z.string(),
    nodeVersion: z.string(),
    gitSha: z.string(),
    gitTag: z.string(),
    imageTag: z.string(),
  })
  .openapi('Meta_BuildResponse');

export const CodeSetMetaSchema = z
  .object({
    codeSet: z.string(),
    providerType: z.string(),
    featureCode: z.string().nullable(),
  })
  .openapi('Meta_CodeSet');

export const CodeSetsMetaResponseSchema = z
  .object({
    codeSets: z.array(CodeSetMetaSchema),
  })
  .openapi('Meta_CodeSetsResponse');

export const CodeRowMetaSchema = z
  .object({
    code: z.string(),
    display: z.string(),
    sort_order: z.number(),
    is_active: z.boolean(),
  })
  .openapi('Meta_CodeRow');

export const CodesMetaResponseSchema = z
  .object({
    items: z.array(CodeRowMetaSchema),
  })
  .openapi('Meta_CodesResponse');

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

export const RoleMetaSchema = z
  .object({
    roleCode: z.string(),
    providerType: z.string(),
    featureCode: z.string().nullable(),
  })
  .openapi('Meta_Role');

export const ListRolesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
    only_enabled_features: z.enum(['true', 'false']).optional(),
  })
  .openapi('Meta_ListRolesQuery');

export const RolesMetaResponseSchema = z
  .object({
    roles: z.array(RoleMetaSchema),
    page: z.object({
      limit: z.number().int().min(1),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable(),
      cursorMode: z.enum(['id']),
    }),
    filters: z.object({
      only_enabled_features: z.boolean().optional(),
    }),
    sort: z.string(),
  })
  .openapi('Meta_RolesResponse');

export const RoleByCodeMetaSchema = z
  .object({
    roleCode: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Meta_RoleByCode');

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
        description: 'DB-backed feature list (code, name, status, enabled)',
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

  registry.registerPath({
    method: 'get',
    path: '/meta/codes',
    tags: ['core.meta'],
    responses: {
      200: {
        description:
          'Registered code sets. Query: only_enabled_features=true to exclude feature-owned sets whose feature is not enabled.',
        content: {
          'application/json': {
            schema: CodeSetsMetaResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/meta/codes/{codeSet}',
    tags: ['core.meta'],
    responses: {
      200: {
        description:
          'Codes for the given code set. Query: active_only=true. 404 if code set not in registry or feature not enabled.',
        content: {
          'application/json': {
            schema: CodesMetaResponseSchema,
          },
        },
      },
      404: { description: 'Code set not found or feature not enabled' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/meta/roles',
    tags: ['core.meta'],
    request: {
      query: ListRolesQuerySchema,
    },
    responses: {
      200: {
        description:
          'Registered roles with cursor pagination. Query: limit, cursor, only_enabled_features=true.',
        content: {
          'application/json': {
            schema: RolesMetaResponseSchema,
          },
        },
      },
      400: { description: 'Invalid query or cursor' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/meta/roles/{roleCode}',
    tags: ['core.meta'],
    responses: {
      200: {
        description: 'Role by code. 404 if not in registry or feature not enabled.',
        content: {
          'application/json': {
            schema: RoleByCodeMetaSchema,
          },
        },
      },
      404: { description: 'Role not found or feature not enabled' },
    },
  });
};
