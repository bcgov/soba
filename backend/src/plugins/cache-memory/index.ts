import type {
  CacheAdapter,
  CachePluginDefinition,
} from '../../core/integrations/cache/CacheAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';

const defaultTtlMs = 5 * 60 * 1000; // 5 minutes

function createInMemoryCacheAdapter(config: PluginConfigReader): CacheAdapter {
  void config; // Required by interface; this plugin does not use config
  const store = new Map<string, { value: unknown; expiresAt?: number }>();

  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    },

    async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
      const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : undefined;
      store.set(key, { value, expiresAt });
    },

    async delete(key: string): Promise<void> {
      store.delete(key);
    },

    async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
      const entry = store.get(key);
      const hit = entry && (entry.expiresAt === undefined || Date.now() <= entry.expiresAt);
      if (hit) return entry!.value as T;
      const value = await factory();
      const effectiveTtl = ttlMs ?? defaultTtlMs;
      store.set(key, { value, expiresAt: Date.now() + effectiveTtl });
      return value;
    },
  };
}

export const cachePluginDefinition: CachePluginDefinition = {
  code: 'cache-memory',
  createAdapter: createInMemoryCacheAdapter,
};
