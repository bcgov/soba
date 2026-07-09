/**
 * Single plugin discovery and cache. Scans plugins dir once (lazy), validates with Zod,
 * exposes workspace resolvers, form engine definitions, plugin API definitions,
 * cache plugins, messagebus plugins, and storage plugins.
 */
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { env } from '../../config/env';
import {
  createPluginConfigReader,
  createStorageProfileConfigReader,
} from '../../config/pluginConfig';
import { getStorageProfilesConfig } from '../../config/storageProfiles';
import type { FormEnginePluginDefinition } from '../form-engine/FormEnginePluginDefinition';
import type { FeatureApiDefinition } from './FeatureApiDefinition';
import type { CacheAdapter, CachePluginDefinition } from '../cache/CacheAdapter';
import type {
  MessageBusAdapter,
  MessageBusPluginDefinition,
} from '../messagebus/MessageBusAdapter';
import type { IdpPluginDefinition } from '../../auth/IdpPlugin';
import type {
  StorageEngineAdapter,
  StorageEngineReadinessResult,
  StoragePluginDefinition,
} from '../storage-engine/StorageEngineAdapter';

const FormEnginePluginDefinitionSchema = z.object({
  code: z.string().min(1),
  metadata: z.object({
    code: z.string(),
    name: z.string(),
    version: z.string().optional(),
  }),
  createAdapter: z.any(),
});

const FeatureApiDefinitionSchema = z.object({
  code: z.string().min(1),
  basePath: z.string(),
  createRouter: z.any(),
  registerOpenApi: z.any().optional(),
});

const CachePluginDefinitionSchema = z.object({
  code: z.string().min(1),
  createAdapter: z.any(),
});

const MessageBusPluginDefinitionSchema = z.object({
  code: z.string().min(1),
  createAdapter: z.any(),
});

const StoragePluginDefinitionSchema = z.object({
  code: z.string().min(1),
  createAdapter: z.any(),
});

const IdpPluginDefinitionSchema = z.object({
  code: z.string().min(1),
  createAuthMiddleware: z.any(),
  createClaimMapper: z.any(),
});

interface CachedPlugin {
  dir: string;
  formEngineDefinition?: FormEnginePluginDefinition;
  apiDefinition?: FeatureApiDefinition;
  cacheDefinition?: CachePluginDefinition;
  messagebusDefinition?: MessageBusPluginDefinition;
  storageDefinition?: StoragePluginDefinition;
  idpDefinition?: IdpPluginDefinition;
}

let cache: CachedPlugin[] | null = null;

function getPluginsRoot(): string {
  const fromEnv = env.getPluginsPath();
  if (fromEnv) return path.resolve(fromEnv);
  // Compiled: this file is dist/src/core/integrations/plugins → ../../../plugins = dist/src/plugins.
  // Do not use process.cwd() for dist (breaks when node is started from repo root or /app).
  const runningFromDist = __dirname.includes(path.sep + 'dist' + path.sep);
  if (runningFromDist) {
    return path.resolve(__dirname, '..', '..', '..', 'plugins');
  }
  return path.resolve(process.cwd(), 'src', 'plugins');
}

/**
 * Read `obj[key]`, validate it with `schema`, and return it typed as `T`. Returns undefined when the
 * key is absent or invalid (logging a warning in the latter case) so a malformed plugin export is
 * skipped rather than fatal.
 */
function parsePluginDefinition<T>(
  obj: Record<string, unknown>,
  pluginDir: string,
  key: string,
  schema: z.ZodTypeAny,
): T | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  const parsed = schema.safeParse(value);
  if (parsed.success) return value as T;
  console.warn(`[PluginRegistry] invalid ${key} in '${pluginDir}':`, parsed.error.message);
  return undefined;
}

/** Load and validate a single plugin module into a CachedPlugin entry. Null when the module fails to
 *  load (logged); individual malformed definitions are skipped by parsePluginDefinition. */
function loadPlugin(pluginsRoot: string, pluginDir: string): CachedPlugin | null {
  const modulePath = path.join(pluginsRoot, pluginDir);
  let raw: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    raw = require(modulePath);
  } catch (err) {
    console.warn(`[PluginRegistry] failed to load plugin '${pluginDir}':`, err);
    return null;
  }

  const obj = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    dir: pluginDir,
    formEngineDefinition: parsePluginDefinition<FormEnginePluginDefinition>(
      obj,
      pluginDir,
      'formEnginePluginDefinition',
      FormEnginePluginDefinitionSchema,
    ),
    apiDefinition: parsePluginDefinition<FeatureApiDefinition>(
      obj,
      pluginDir,
      'pluginApiDefinition',
      FeatureApiDefinitionSchema,
    ),
    cacheDefinition: parsePluginDefinition<CachePluginDefinition>(
      obj,
      pluginDir,
      'cachePluginDefinition',
      CachePluginDefinitionSchema,
    ),
    messagebusDefinition: parsePluginDefinition<MessageBusPluginDefinition>(
      obj,
      pluginDir,
      'messagebusPluginDefinition',
      MessageBusPluginDefinitionSchema,
    ),
    storageDefinition: parsePluginDefinition<StoragePluginDefinition>(
      obj,
      pluginDir,
      'storagePluginDefinition',
      StoragePluginDefinitionSchema,
    ),
    idpDefinition: parsePluginDefinition<IdpPluginDefinition>(
      obj,
      pluginDir,
      'idpPluginDefinition',
      IdpPluginDefinitionSchema,
    ),
  };
}

function discoverAndCache(): CachedPlugin[] {
  if (cache) return cache;

  const pluginsRoot = getPluginsRoot();
  if (!fs.existsSync(pluginsRoot)) {
    cache = [];
    return cache;
  }

  const pluginDirs = fs
    .readdirSync(pluginsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const result: CachedPlugin[] = [];
  for (const pluginDir of pluginDirs) {
    const entry = loadPlugin(pluginsRoot, pluginDir);
    if (entry) result.push(entry);
  }

  cache = result;
  return cache;
}

export interface PluginCatalogEntry {
  code: string;
  hasApi: boolean;
  apiBasePath?: string;
}

export function getPluginCatalog(): PluginCatalogEntry[] {
  const discovered = discoverAndCache();
  return discovered.map((p) => {
    const code =
      p.apiDefinition?.code ??
      p.formEngineDefinition?.code ??
      p.cacheDefinition?.code ??
      p.messagebusDefinition?.code ??
      p.dir;
    return {
      code,
      hasApi: Boolean(p.apiDefinition),
      apiBasePath: p.apiDefinition?.basePath,
    };
  });
}

export function getEnabledPluginApiDefinitions(): FeatureApiDefinition[] {
  const discovered = discoverAndCache();
  return discovered.filter((p) => p.apiDefinition).map((p) => p.apiDefinition!);
}

export interface FormEnginePluginCatalogEntry {
  code: string;
  name: string;
  version?: string;
}

export function getFormEnginePluginCatalog(): FormEnginePluginCatalogEntry[] {
  const discovered = discoverAndCache();
  return discovered
    .filter((p) => p.formEngineDefinition)
    .map((p) => ({
      code: p.formEngineDefinition!.code,
      name: p.formEngineDefinition!.metadata.name,
      version: p.formEngineDefinition!.metadata.version,
    }));
}

export function getFormEnginePluginDefinitions(): FormEnginePluginDefinition[] {
  const discovered = discoverAndCache();
  return discovered
    .map((p) => p.formEngineDefinition)
    .filter((d): d is FormEnginePluginDefinition => Boolean(d));
}

export function getCachePluginDefinitions(): CachePluginDefinition[] {
  const discovered = discoverAndCache();
  return discovered
    .map((p) => p.cacheDefinition)
    .filter((d): d is CachePluginDefinition => Boolean(d));
}

export function getMessageBusPluginDefinitions(): MessageBusPluginDefinition[] {
  const discovered = discoverAndCache();
  return discovered
    .map((p) => p.messagebusDefinition)
    .filter((d): d is MessageBusPluginDefinition => Boolean(d));
}

export function getStoragePluginDefinitions(): StoragePluginDefinition[] {
  const discovered = discoverAndCache();
  return discovered
    .map((p) => p.storageDefinition)
    .filter((d): d is StoragePluginDefinition => Boolean(d));
}

export function getIdpPluginDefinitions(): IdpPluginDefinition[] {
  const discovered = discoverAndCache();
  return discovered.map((p) => p.idpDefinition).filter((d): d is IdpPluginDefinition => Boolean(d));
}

let cacheAdapterInstance: CacheAdapter | null = null;

export function getCacheAdapter(): CacheAdapter {
  if (!cacheAdapterInstance) {
    const code = env.getCacheDefaultCode() ?? 'cache-memory';
    const definitions = getCachePluginDefinitions();
    const definition = definitions.find((d) => d.code === code);
    if (!definition) {
      throw new Error(
        `No cache plugin is installed for code '${code}'. Available: ${definitions.map((d) => d.code).join(', ') || '<none>'}`,
      );
    }
    cacheAdapterInstance = definition.createAdapter(createPluginConfigReader(definition.code));
  }
  return cacheAdapterInstance;
}

let messageBusAdapterInstance: MessageBusAdapter | null = null;

export function getMessageBusAdapter(): MessageBusAdapter {
  if (!messageBusAdapterInstance) {
    const code = env.getMessageBusDefaultCode() ?? 'messagebus-memory';
    const definitions = getMessageBusPluginDefinitions();
    const definition = definitions.find((d) => d.code === code);
    if (!definition) {
      throw new Error(
        `No messagebus plugin is installed for code '${code}'. Available: ${definitions.map((d) => d.code).join(', ') || '<none>'}`,
      );
    }
    messageBusAdapterInstance = definition.createAdapter(createPluginConfigReader(definition.code));
  }
  return messageBusAdapterInstance;
}

const storageAdapterByProfile = new Map<string, StorageEngineAdapter>();

/**
 * Storage adapter for a profile (default 'default'). Profiles let multiple backends run at once
 * (e.g. separate S3 buckets); each is configured under STORAGE_PROFILE_<PROFILE>_* and cached.
 */
export function getStorageAdapter(profile: string = 'default'): StorageEngineAdapter {
  const cached = storageAdapterByProfile.get(profile);
  if (cached) return cached;

  const profiles = getStorageProfilesConfig();
  const profileConfig = profiles[profile];
  if (!profileConfig) {
    throw new Error(
      `No storage profile '${profile}' is configured. Available: ${Object.keys(profiles).join(', ') || '<none>'}`,
    );
  }
  const definitions = getStoragePluginDefinitions();
  const definition = definitions.find((d) => d.code === profileConfig.backend);
  if (!definition) {
    throw new Error(
      `Storage profile '${profile}' uses backend '${profileConfig.backend}', which is not installed. Available: ${definitions.map((d) => d.code).join(', ') || '<none>'}`,
    );
  }
  const adapter = definition.createAdapter(createStorageProfileConfigReader(profile));
  storageAdapterByProfile.set(profile, adapter);
  return adapter;
}

/**
 * Readiness of every configured storage profile, keyed by profile name. Never throws — a profile
 * that is unreachable or misconfigured yields { ok: false, message }; one with no readinessCheck
 * yields { ok: true }.
 */
export async function checkStorageReadiness(): Promise<
  Record<string, StorageEngineReadinessResult>
> {
  const results: Record<string, StorageEngineReadinessResult> = {};
  for (const profile of Object.keys(getStorageProfilesConfig())) {
    try {
      const adapter = getStorageAdapter(profile);
      results[profile] = (await adapter.readinessCheck?.()) ?? { ok: true };
    } catch (err) {
      results[profile] = { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }
  return results;
}
