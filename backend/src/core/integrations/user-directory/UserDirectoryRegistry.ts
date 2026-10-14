import { createPluginConfigReader } from '../../config/pluginConfig';
import { env } from '../../config/env';
import type { UserDirectoryAdapter, UserDirectoryReadinessResult } from './UserDirectoryAdapter';
import type { UserDirectoryPluginDefinition } from './UserDirectoryPluginDefinition';
import {
  getUserDirectoryPluginCatalog,
  getUserDirectoryPluginDefinitions,
} from '../plugins/PluginRegistry';
import type { UserDirectoryPluginCatalogEntry } from '../plugins/PluginRegistry';

let cachedDefinitions: Map<string, UserDirectoryPluginDefinition> | null = null;

const getDefinitionsMap = (): Map<string, UserDirectoryPluginDefinition> => {
  if (!cachedDefinitions) {
    const definitions = getUserDirectoryPluginDefinitions();
    cachedDefinitions = new Map(definitions.map((definition) => [definition.code, definition]));
  }
  return cachedDefinitions;
};

export const getUserDirectoryPlugins = (): UserDirectoryPluginCatalogEntry[] =>
  getUserDirectoryPluginCatalog();

export const resolveUserDirectoryPlugin = (code: string): UserDirectoryPluginDefinition => {
  const definition = getDefinitionsMap().get(code);
  if (!definition) {
    throw new Error(`No user directory plugin is installed for code '${code}'`);
  }
  return definition;
};

export const createUserDirectoryAdapter = (code: string): UserDirectoryAdapter => {
  const definition = resolveUserDirectoryPlugin(code);
  return definition.createAdapter(createPluginConfigReader(code));
};

// CSS is the default directory; missing configuration is reported by readiness and search.
const DEFAULT_USER_DIRECTORY_CODE = 'css-v1';

/** Directory code the consumer defaults to: USER_DIRECTORY_DEFAULT_CODE, else css-v1. */
export const resolveDefaultUserDirectoryCode = (): string =>
  env.getUserDirectoryDefaultCode() ?? DEFAULT_USER_DIRECTORY_CODE;

/** Adapter for the default directory (see resolveDefaultUserDirectoryCode). */
export const createDefaultUserDirectoryAdapter = (): UserDirectoryAdapter =>
  createUserDirectoryAdapter(resolveDefaultUserDirectoryCode());

/**
 * Run readiness on each registered user directory. Only reachability (ok/message) is returned; no
 * config. An adapter without a readinessCheck is reported ok.
 */
export const checkUserDirectoryReadiness = async (): Promise<
  Record<string, UserDirectoryReadinessResult>
> => {
  const catalog = getUserDirectoryPluginCatalog();
  const results: Record<string, UserDirectoryReadinessResult> = {};
  for (const entry of catalog) {
    try {
      const adapter = createUserDirectoryAdapter(entry.code);
      results[entry.code] =
        typeof adapter.readinessCheck === 'function'
          ? await adapter.readinessCheck()
          : { ok: true };
    } catch (err) {
      results[entry.code] = {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
  return results;
};
