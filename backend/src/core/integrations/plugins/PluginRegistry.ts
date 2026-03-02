/**
 * Single plugin discovery and cache. Scans plugins dir once (lazy), validates with Zod,
 * exposes workspace resolvers, form engine definitions, plugin API definitions,
 * cache plugins, and messagebus plugins.
 */
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { env } from '../../config/env';
import { getWorkspacePluginsConfig } from '../../config/workspacePlugins';
import { createPluginConfigReader } from '../../config/pluginConfig';
import type {
  WorkspaceResolver,
  WorkspaceResolverDefinition,
} from '../workspace/WorkspaceResolver';
import type { FormEnginePluginDefinition } from '../form-engine/FormEnginePluginDefinition';
import type { FeatureApiDefinition } from './FeatureApiDefinition';
import type { CacheAdapter, CachePluginDefinition } from '../cache/CacheAdapter';
import type {
  MessageBusAdapter,
  MessageBusPluginDefinition,
} from '../messagebus/MessageBusAdapter';

const WorkspaceResolverDefinitionSchema = z.object({
  code: z.string().min(1),
  createResolver: z.any(),
});

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

interface CachedPlugin {
  dir: string;
  workspaceDefinition?: WorkspaceResolverDefinition;
  formEngineDefinition?: FormEnginePluginDefinition;
  apiDefinition?: FeatureApiDefinition;
  cacheDefinition?: CachePluginDefinition;
  messagebusDefinition?: MessageBusPluginDefinition;
}

let cache: CachedPlugin[] | null = null;

function getPluginsRoot(): string {
  const fromEnv = env.getPluginsPath();
  if (fromEnv) return path.resolve(fromEnv);
  // When running compiled (from dist/), load plugins from dist/src/plugins.
  // When running from source (tsx/ts-node), use src/plugins.
  const runningFromDist = __dirname.includes(path.sep + 'dist' + path.sep);
  const pluginsDir = runningFromDist
    ? path.join('dist', 'src', 'plugins')
    : path.join('src', 'plugins');
  return path.resolve(process.cwd(), pluginsDir);
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
    const modulePath = path.join(pluginsRoot, pluginDir);
    let raw: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      raw = require(modulePath);
    } catch (err) {
      console.warn(`[PluginRegistry] failed to load plugin '${pluginDir}':`, err);
      continue;
    }

    const entry: CachedPlugin = { dir: pluginDir };

    const obj = raw !== null && typeof raw === 'object' ? raw : {};
    const workspaceDef = (obj as Record<string, unknown>).workspacePluginDefinition;
    if (workspaceDef !== undefined) {
      const parsed = WorkspaceResolverDefinitionSchema.safeParse(workspaceDef);
      if (parsed.success) {
        entry.workspaceDefinition = workspaceDef as WorkspaceResolverDefinition;
      } else {
        console.warn(
          `[PluginRegistry] invalid workspacePluginDefinition in '${pluginDir}':`,
          parsed.error.message,
        );
      }
    }

    const formEngineDef = (obj as Record<string, unknown>).formEnginePluginDefinition;
    if (formEngineDef !== undefined) {
      const parsed = FormEnginePluginDefinitionSchema.safeParse(formEngineDef);
      if (parsed.success) {
        entry.formEngineDefinition = formEngineDef as FormEnginePluginDefinition;
      } else {
        console.warn(
          `[PluginRegistry] invalid formEnginePluginDefinition in '${pluginDir}':`,
          parsed.error.message,
        );
      }
    }

    const apiDef = (obj as Record<string, unknown>).pluginApiDefinition;
    if (apiDef !== undefined) {
      const parsed = FeatureApiDefinitionSchema.safeParse(apiDef);
      if (parsed.success) {
        entry.apiDefinition = apiDef as FeatureApiDefinition;
      } else {
        console.warn(
          `[PluginRegistry] invalid pluginApiDefinition in '${pluginDir}':`,
          parsed.error.message,
        );
      }
    }

    const cacheDef = (obj as Record<string, unknown>).cachePluginDefinition;
    if (cacheDef !== undefined) {
      const parsed = CachePluginDefinitionSchema.safeParse(cacheDef);
      if (parsed.success) {
        entry.cacheDefinition = cacheDef as CachePluginDefinition;
      } else {
        console.warn(
          `[PluginRegistry] invalid cachePluginDefinition in '${pluginDir}':`,
          parsed.error.message,
        );
      }
    }

    const messagebusDef = (obj as Record<string, unknown>).messagebusPluginDefinition;
    if (messagebusDef !== undefined) {
      const parsed = MessageBusPluginDefinitionSchema.safeParse(messagebusDef);
      if (parsed.success) {
        entry.messagebusDefinition = messagebusDef as MessageBusPluginDefinition;
      } else {
        console.warn(
          `[PluginRegistry] invalid messagebusPluginDefinition in '${pluginDir}':`,
          parsed.error.message,
        );
      }
    }

    result.push(entry);
  }

  cache = result;
  return cache;
}

let workspaceResolversCache: WorkspaceResolver[] | null = null;

export function getWorkspaceResolvers(): WorkspaceResolver[] {
  if (workspaceResolversCache) return workspaceResolversCache;
  const config = getWorkspacePluginsConfig();
  const discovered = discoverAndCache();
  const definitions = discovered
    .map((p) => p.workspaceDefinition)
    .filter((d): d is WorkspaceResolverDefinition => Boolean(d));

  const discoveredCodes = definitions.map((d) => d.code);
  const unknownCodes = config.enabledPlugins.filter((code) => !discoveredCodes.includes(code));
  if (unknownCodes.length > 0) {
    const message = `Unknown workspace plugins configured: ${unknownCodes.join(', ')}`;
    if (config.strictMode) throw new Error(message);
    console.warn(message);
  }

  const selected = definitions.filter((d) => config.enabledPlugins.includes(d.code));
  workspaceResolversCache = selected
    .map((d) => d.createResolver(createPluginConfigReader(d.code)))
    .sort((a, b) => a.priority - b.priority);

  const enabledList = workspaceResolversCache.map((r) => r.code).join(', ') || '<none>';
  console.log(
    `[workspace-plugins] strictMode=${config.strictMode} enabled=${enabledList} order=${workspaceResolversCache
      .map((r) => `${r.code}:${r.priority}`)
      .join(' -> ')}`,
  );

  if (workspaceResolversCache.length === 0) {
    throw new Error('No workspace resolvers enabled. Check WORKSPACE_PLUGINS_ENABLED.');
  }

  return workspaceResolversCache;
}

export interface PluginCatalogEntry {
  code: string;
  enabled: boolean;
  hasWorkspaceResolver: boolean;
  hasApi: boolean;
  apiBasePath?: string;
}

export function getPluginCatalog(): PluginCatalogEntry[] {
  const config = getWorkspacePluginsConfig();
  const discovered = discoverAndCache();
  return discovered.map((p) => {
    const code =
      p.workspaceDefinition?.code ??
      p.apiDefinition?.code ??
      p.formEngineDefinition?.code ??
      p.cacheDefinition?.code ??
      p.messagebusDefinition?.code ??
      p.dir;
    return {
      code,
      enabled: config.enabledPlugins.includes(code),
      hasWorkspaceResolver: Boolean(p.workspaceDefinition),
      hasApi: Boolean(p.apiDefinition),
      apiBasePath: p.apiDefinition?.basePath,
    };
  });
}

export function getEnabledPluginApiDefinitions(): FeatureApiDefinition[] {
  const config = getWorkspacePluginsConfig();
  const discovered = discoverAndCache();
  return discovered
    .filter((p) => p.workspaceDefinition && p.apiDefinition)
    .filter((p) => config.enabledPlugins.includes(p.workspaceDefinition!.code))
    .map((p) => p.apiDefinition!);
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
