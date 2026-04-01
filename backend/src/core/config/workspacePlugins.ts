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
  allowedPlugins: WorkspacePluginCode[];
  strictMode: boolean;
}

/** Minimal env reader for workspace plugins config (e.g. from createEnvReader). */
export interface WorkspacePluginsEnvReaderType {
  getWorkspacePluginsAllowed(): string;
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
  const allowedPlugins = parseCsv(reader.getWorkspacePluginsAllowed()) as WorkspacePluginCode[];
  if (allowedPlugins.length === 0) {
    throw new Error('WORKSPACE_PLUGINS_ALLOWED must include at least one plugin code');
  }
  return {
    allowedPlugins,
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
