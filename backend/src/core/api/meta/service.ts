import packageJson from '../../../../package.json';
import { env } from '../../config/env';
import { getWorkspacePluginsConfig } from '../../config/workspacePlugins';
import { getFormEnginePlugins } from '../../integrations/form-engine/FormEngineRegistry';
import { getPluginCatalog } from '../../integrations/plugins/PluginRegistry';
import { isFeatureEnabled, listFeatures } from '../../db/repos/featureRepo';
import { roleService } from '../../services/roleService';
import { decodeCursor, encodeCursor } from '../shared/pagination';

export const metaApiService = {
  getPlugins() {
    const config = getWorkspacePluginsConfig();
    const plugins = getPluginCatalog();
    const activeFormEngineCode =
      env.getFormEngineDefaultCode() ?? getFormEnginePlugins()[0]?.code ?? 'formio-v5';
    const activeCacheCode = env.getCacheDefaultCode() ?? 'cache-memory';
    const activeMessageBusCode = env.getMessageBusDefaultCode() ?? 'messagebus-memory';
    const activeCodes = new Set([
      activeFormEngineCode,
      activeCacheCode,
      activeMessageBusCode,
      ...config.enabledPlugins,
    ]);
    return {
      enabledPluginCodes: config.enabledPlugins,
      plugins: plugins.map((plugin) => ({
        ...plugin,
        enabled: activeCodes.has(plugin.code),
      })),
    };
  },

  async getFeatures() {
    const features = await listFeatures();
    return {
      features: features.map((f) => ({
        code: f.code,
        name: f.name,
        description: f.description,
        version: f.version,
        status: f.status,
        enabled: isFeatureEnabled(f.status),
      })),
    };
  },

  getBuild() {
    return {
      name: packageJson.name,
      version: packageJson.version,
      nodeVersion: process.version,
      gitSha: env.getOptionalEnv('GIT_SHA') ?? 'unknown',
      gitTag: env.getOptionalEnv('GIT_TAG') ?? 'unknown',
      imageTag: env.getOptionalEnv('IMAGE_TAG') ?? 'unknown',
    };
  },

  async getFormEngines() {
    const plugins = getFormEnginePlugins();
    const defaultCode = env.getFormEngineDefaultCode();
    return {
      items: plugins.map((plugin) => ({
        code: plugin.code,
        name: plugin.name,
        engineVersion: plugin.version ?? null,
        isDefault: plugin.code === (defaultCode ?? plugins[0]?.code ?? null),
      })),
    };
  },

  async getRoles(options?: { onlyEnabledFeatures?: boolean }) {
    return roleService.getRegisteredRoles(options);
  },

  async getRolesPaginated(query: {
    limit: number;
    cursor?: string;
    onlyEnabledFeatures?: boolean;
  }) {
    let afterRoleCode: string | undefined;
    if (query.cursor) {
      try {
        const decoded = decodeCursor(query.cursor);
        if (decoded.m === 'id') afterRoleCode = decoded.id;
      } catch {
        // invalid cursor ignored; first page
      }
    }
    const { items, hasMore } = await roleService.getRegisteredRolesPaginated({
      limit: query.limit,
      afterRoleCode,
      onlyEnabledFeatures: query.onlyEnabledFeatures,
    });
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? encodeCursor({ m: 'id', id: lastItem.roleCode }) : null;
    return {
      roles: items,
      page: {
        limit: query.limit,
        hasMore,
        nextCursor,
        cursorMode: 'id' as const,
      },
      filters: {
        only_enabled_features: query.onlyEnabledFeatures,
      },
      sort: 'roleCode:desc' as const,
    };
  },

  async getRole(roleCode: string, options?: { onlyEnabledFeatures?: boolean }) {
    return roleService.getRole(roleCode, options);
  },
};
