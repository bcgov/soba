import fs from 'fs';
import path from 'path';
import { WorkspaceResolver, WorkspaceResolverDefinition } from './WorkspaceResolver';
import { getWorkspacePluginsConfig } from '../../config/workspacePlugins';
import { createPluginConfigReader } from '../../config/pluginConfig';

let registry: WorkspaceResolver[] | null = null;

const discoverResolverDefinitions = (): WorkspaceResolverDefinition[] => {
  const pluginsRoot = path.resolve(__dirname, '../../../plugins');
  if (!fs.existsSync(pluginsRoot)) {
    return [];
  }

  const pluginDirs = fs
    .readdirSync(pluginsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const definitions: WorkspaceResolverDefinition[] = [];
  for (const pluginDir of pluginDirs) {
    const modulePath = path.join(pluginsRoot, pluginDir);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const moduleExports = require(modulePath) as {
      workspacePluginDefinition?: WorkspaceResolverDefinition;
    };
    const definition = moduleExports.workspacePluginDefinition;
    if (!definition) {
      console.warn(
        `[workspace-plugins] skipped '${pluginDir}' (missing workspacePluginDefinition)`,
      );
      continue;
    }
    definitions.push(definition);
  }

  return definitions;
};

export const getWorkspaceResolvers = (): WorkspaceResolver[] => {
  if (!registry) {
    const config = getWorkspacePluginsConfig();
    const definitions = discoverResolverDefinitions();
    const discoveredCodes = definitions.map((definition) => definition.code);

    const enabledCodes = config.enabledPlugins;

    const unknownCodes = enabledCodes.filter((code) => !discoveredCodes.includes(code));
    if (unknownCodes.length > 0) {
      const message = `Unknown workspace plugins configured: ${unknownCodes.join(', ')}`;
      if (config.strictMode) {
        throw new Error(message);
      }
      console.warn(message);
    }

    const selectedDefinitions = definitions.filter((definition) =>
      enabledCodes.includes(definition.code),
    );
    registry = selectedDefinitions
      .map((definition) => definition.createResolver(createPluginConfigReader(definition.code)))
      .sort((a, b) => a.priority - b.priority);

    const enabledList = registry.map((resolver) => resolver.code).join(', ') || '<none>';
    console.log(
      `[workspace-plugins] strictMode=${config.strictMode} enabled=${enabledList} order=${registry
        .map((resolver) => `${resolver.code}:${resolver.priority}`)
        .join(' -> ')}`,
    );

    if (registry.length === 0) {
      throw new Error('No workspace resolvers enabled. Check WORKSPACE_PLUGINS_ENABLED.');
    }
  }
  return registry;
};
