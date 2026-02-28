import { WorkspacePluginCode } from '../integrations/workspace/WorkspaceResolver';
import { env } from './env';

const parseCsv = (value: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export interface WorkspacePluginsConfig {
  enabledPlugins: WorkspacePluginCode[];
  strictMode: boolean;
}

let cachedConfig: WorkspacePluginsConfig | null = null;

export const getWorkspacePluginsConfig = (): WorkspacePluginsConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const strictModeRaw = env.getWorkspacePluginsStrictModeRaw().trim().toLowerCase();
  if (strictModeRaw !== 'true' && strictModeRaw !== 'false') {
    throw new Error("WORKSPACE_PLUGINS_STRICT_MODE must be 'true' or 'false'");
  }
  const strictMode = strictModeRaw === 'true';
  const enabledPlugins = parseCsv(env.getWorkspacePluginsEnabled()) as WorkspacePluginCode[];
  if (enabledPlugins.length === 0) {
    throw new Error('WORKSPACE_PLUGINS_ENABLED must include at least one plugin code');
  }
  cachedConfig = {
    enabledPlugins,
    strictMode,
  };

  return cachedConfig;
};
