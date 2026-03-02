/**
 * Pluggable cache adapter interface. Implementations are provided by plugins
 * (e.g. cache-memory, cache-redis) and selected via CACHE_DEFAULT_CODE.
 */
import type { PluginConfigReader } from '../../config/pluginConfig';

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  getOrSet?<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T>;
}

export interface CachePluginDefinition {
  code: string;
  createAdapter: (config: PluginConfigReader) => CacheAdapter;
}
