import { createPluginConfigReader } from '../../config/pluginConfig';
import { TenantEngineAdapter, type TenantEngineReadinessResult } from './TenantEngineAdapter';
import { TenantEnginePluginDefinition } from './TenantEnginePluginDefinition';
import {
  getTenantEnginePluginCatalog,
  getTenantEnginePluginDefinitions,
} from '../plugins/PluginRegistry';
import type { TenantEnginePluginCatalogEntry } from '../plugins/PluginRegistry';

let cachedDefinitions: Map<string, TenantEnginePluginDefinition> | null = null;

const getDefinitionsMap = (): Map<string, TenantEnginePluginDefinition> => {
  if (!cachedDefinitions) {
    const definitions = getTenantEnginePluginDefinitions();
    cachedDefinitions = new Map(definitions.map((definition) => [definition.code, definition]));
  }
  return cachedDefinitions;
};

export const getTenantEnginePlugins = (): TenantEnginePluginCatalogEntry[] =>
  getTenantEnginePluginCatalog();

export const resolveTenantEnginePlugin = (engineCode: string): TenantEnginePluginDefinition => {
  const definition = getDefinitionsMap().get(engineCode);
  if (!definition) {
    throw new Error(`No tenant engine plugin is installed for code '${engineCode}'`);
  }
  return definition;
};

export const createTenantEngineAdapter = (engineCode: string): TenantEngineAdapter => {
  const definition = resolveTenantEnginePlugin(engineCode);
  return definition.createAdapter(createPluginConfigReader(engineCode));
};

/**
 * Run readiness check on each registered tenant engine. Only reachability (ok/message) is returned; no config.
 */
export const checkTenantEngineReadiness = async (): Promise<
  Record<string, TenantEngineReadinessResult>
> => {
  const catalog = getTenantEnginePluginCatalog();
  const results: Record<string, TenantEngineReadinessResult> = {};
  for (const entry of catalog) {
    try {
      const adapter = createTenantEngineAdapter(entry.code);
      if (typeof adapter.readinessCheck === 'function') {
        results[entry.code] = await adapter.readinessCheck();
      } else {
        results[entry.code] = { ok: true };
      }
    } catch (err) {
      results[entry.code] = {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
  return results;
};
