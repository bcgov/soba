import { createPluginConfigReader } from '../../config/pluginConfig';
import { FormEngineAdapter, type FormEngineHealthResult } from './FormEngineAdapter';
import { FormEnginePluginDefinition } from './FormEnginePluginDefinition';
import {
  getFormEnginePluginCatalog,
  getFormEnginePluginDefinitions,
} from '../plugins/PluginRegistry';
import type { FormEnginePluginCatalogEntry } from '../plugins/PluginRegistry';

let cachedDefinitions: Map<string, FormEnginePluginDefinition> | null = null;

const getDefinitionsMap = (): Map<string, FormEnginePluginDefinition> => {
  if (!cachedDefinitions) {
    const definitions = getFormEnginePluginDefinitions();
    cachedDefinitions = new Map(definitions.map((definition) => [definition.code, definition]));
  }
  return cachedDefinitions;
};

export const getFormEnginePlugins = (): FormEnginePluginCatalogEntry[] =>
  getFormEnginePluginCatalog();

export const resolveFormEnginePlugin = (engineCode: string): FormEnginePluginDefinition => {
  const definition = getDefinitionsMap().get(engineCode);
  if (!definition) {
    throw new Error(`No form engine plugin is installed for code '${engineCode}'`);
  }
  return definition;
};

export const createFormEngineAdapter = (engineCode: string): FormEngineAdapter => {
  const definition = resolveFormEnginePlugin(engineCode);
  return definition.createAdapter(createPluginConfigReader(engineCode));
};

/**
 * Run health check on each registered form engine. Only reachability (ok/message) is returned; no config.
 */
export const checkFormEngineHealth = async (): Promise<Record<string, FormEngineHealthResult>> => {
  const catalog = getFormEnginePluginCatalog();
  const results: Record<string, FormEngineHealthResult> = {};
  for (const entry of catalog) {
    try {
      const adapter = createFormEngineAdapter(entry.code);
      if (typeof adapter.healthCheck === 'function') {
        results[entry.code] = await adapter.healthCheck();
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
