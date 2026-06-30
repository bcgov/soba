import { env } from './env';
import { normalizeKey } from './pluginConfig';
import { log } from '../logging';

export interface StorageProfileConfig {
  /** Storage backend plugin code this profile instantiates (e.g. 'local-storage', 's3-compatible'). */
  backend: string;
}

let cached: Record<string, StorageProfileConfig> | null = null;

/**
 * Parse storage profiles from env. Each profile listed in STORAGE_PROFILES must declare
 * STORAGE_PROFILE_<PROFILE>_BACKEND; its backend-specific config lives under the same prefix.
 * When STORAGE_PROFILES is empty, development falls back to a single 'default' profile on
 * 'local-storage' (zero-config local dev); any other environment fails hard, so a forgotten
 * production config errors loudly instead of silently writing to ephemeral local disk.
 */
export function getStorageProfilesConfig(): Record<string, StorageProfileConfig> {
  if (cached) return cached;
  const profiles: Record<string, StorageProfileConfig> = {};
  for (const name of env.getStorageProfiles()) {
    const backend = env.getOptionalEnv(`STORAGE_PROFILE_${normalizeKey(name)}_BACKEND`);
    if (!backend) {
      throw new Error(
        `Storage profile '${name}' is missing STORAGE_PROFILE_${normalizeKey(name)}_BACKEND`,
      );
    }
    profiles[name] = { backend };
  }
  if (Object.keys(profiles).length === 0) {
    if (!env.isDevelopment()) {
      throw new Error(
        'No storage profiles configured. Set STORAGE_PROFILES and a STORAGE_PROFILE_<PROFILE>_BACKEND for each.',
      );
    }
    log.warn(
      "[storage-profiles] STORAGE_PROFILES is empty; defaulting to a single 'default' profile on " +
        'local-storage. This fallback is development-only and fails hard in other environments.',
    );
    profiles.default = { backend: 'local-storage' };
  }
  cached = profiles;
  return cached;
}
