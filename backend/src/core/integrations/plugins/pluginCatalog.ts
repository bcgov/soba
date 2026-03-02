import fs from 'fs';
import path from 'path';
import { getWorkspacePluginsConfig } from '../../config/workspacePlugins';
import { WorkspaceResolverDefinition } from '../workspace/WorkspaceResolver';
import { FeatureApiDefinition } from './FeatureApiDefinition';

interface DiscoveredPluginModule {
  workspacePluginDefinition?: WorkspaceResolverDefinition;
  pluginApiDefinition?: FeatureApiDefinition;
}

export interface PluginCatalogEntry {
  code: string;
  enabled: boolean;
  hasWorkspaceResolver: boolean;
  hasApi: boolean;
  apiBasePath?: string;
}

const getPluginsRoot = () => path.resolve(__dirname, '../../../plugins');

const discoverPluginModules = (): Array<{ dir: string; module: DiscoveredPluginModule }> => {
  const pluginsRoot = getPluginsRoot();
  if (!fs.existsSync(pluginsRoot)) {
    return [];
  }

  const pluginDirs = fs
    .readdirSync(pluginsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  return pluginDirs.map((pluginDir) => {
    const modulePath = path.join(pluginsRoot, pluginDir);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pluginModule = require(modulePath) as DiscoveredPluginModule;
    return { dir: pluginDir, module: pluginModule };
  });
};

export const getPluginCatalog = (): PluginCatalogEntry[] => {
  const config = getWorkspacePluginsConfig();
  const modules = discoverPluginModules();

  return modules.map(({ dir, module }) => {
    const workspaceDef = module.workspacePluginDefinition;
    const apiDef = module.pluginApiDefinition;
    const code = workspaceDef?.code || apiDef?.code || dir;
    return {
      code,
      enabled: config.enabledPlugins.includes(code),
      hasWorkspaceResolver: Boolean(workspaceDef),
      hasApi: Boolean(apiDef),
      apiBasePath: apiDef?.basePath,
    };
  });
};

export const getEnabledPluginApiDefinitions = (): FeatureApiDefinition[] => {
  const config = getWorkspacePluginsConfig();
  const modules = discoverPluginModules();

  return modules
    .map(({ module }) => ({
      workspaceDefinition: module.workspacePluginDefinition,
      apiDefinition: module.pluginApiDefinition,
    }))
    .filter((entry) => Boolean(entry.workspaceDefinition && entry.apiDefinition))
    .filter((entry) => config.enabledPlugins.includes(entry.workspaceDefinition!.code))
    .map((entry) => entry.apiDefinition!);
};
