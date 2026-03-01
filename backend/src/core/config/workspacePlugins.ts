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

/** Minimal env reader for workspace plugins config (e.g. from createEnvReader). */
export interface WorkspacePluginsEnvReaderType {
  getWorkspacePluginsEnabled(): string;
  getWorkspacePluginsStrictModeRaw(): string;
}

/** Parse workspace plugins config from an env reader. No cache. Use in tests with createEnvReader(simulated). */
export function parseWorkspacePluginsConfig(
  reader: WorkspacePluginsEnvReaderType,
): WorkspacePluginsConfig {
  const strictModeRaw = reader.getWorkspacePluginsStrictModeRaw().trim().toLowerCase();
  if (strictModeRaw !== 'true' && strictModeRaw !== 'false') {
    throw new Error("WORKSPACE_PLUGINS_STRICT_MODE must be 'true' or 'false'");
  }
  const strictMode = strictModeRaw === 'true';
  const enabledPlugins = parseCsv(reader.getWorkspacePluginsEnabled()) as WorkspacePluginCode[];
  if (enabledPlugins.length === 0) {
    throw new Error('WORKSPACE_PLUGINS_ENABLED must include at least one plugin code');
  }
  return {
    enabledPlugins,
    strictMode,
  };
}

let cachedConfig: WorkspacePluginsConfig | null = null;

export const getWorkspacePluginsConfig = (): WorkspacePluginsConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }
  cachedConfig = parseWorkspacePluginsConfig(env);
  return cachedConfig;
};
