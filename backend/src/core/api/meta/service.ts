import packageJson from '../../../../package.json';
import { env } from '../../config/env';
import { getWorkspacePluginsConfig } from '../../config/workspacePlugins';
import { listPlatformFormEngines } from '../../db/repos/platformFormEngineRepo';
import { getFormEnginePlugins } from '../../integrations/form-engine/FormEngineRegistry';
import { getPluginCatalog } from '../../integrations/plugins/pluginCatalog';

const CORE_FEATURES = ['form-versions', 'submissions', 'meta'];

export const metaApiService = {
  getPlugins() {
    const config = getWorkspacePluginsConfig();
    const plugins = getPluginCatalog();
    return {
      enabledPluginCodes: config.enabledPlugins,
      plugins,
    };
  },

  getFeatures() {
    const plugins = getPluginCatalog();
    return {
      coreFeatures: CORE_FEATURES,
      pluginFeatures: plugins
        .filter((plugin) => Boolean(plugin.apiBasePath))
        .map((plugin) => ({
          code: plugin.code,
          apiBasePath: plugin.apiBasePath as string,
          enabled: plugin.enabled,
        })),
    };
  },

  getBuild() {
    return {
      name: packageJson.name,
      version: packageJson.version,
      nodeVersion: process.version,
      formioVersion: env.getFormioVersion(),
      gitSha: env.getOptionalEnv('GIT_SHA', 'unknown') as string,
      gitTag: env.getOptionalEnv('GIT_TAG', 'unknown') as string,
      imageTag: env.getOptionalEnv('IMAGE_TAG', 'unknown') as string,
    };
  },

  async getFormEngines() {
    const [platformEngines, installedPlugins] = await Promise.all([
      listPlatformFormEngines(),
      Promise.resolve(getFormEnginePlugins()),
    ]);
    const installedCodes = new Set(installedPlugins.map((plugin) => plugin.code));
    return {
      items: platformEngines.map((engine) => ({
        id: engine.id,
        code: engine.code,
        name: engine.name,
        engineVersion: engine.engineVersion,
        isActive: engine.isActive,
        isDefault: engine.isDefault,
        installedPlugin: installedCodes.has(engine.code),
      })),
    };
  },
};
