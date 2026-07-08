/**
 * Plugin discovery + selection. Scans the plugins dir once (lazy, cached),
 * validates each module's exported definitions with Zod, and exposes:
 *   - per-kind definition lists (form engine, feature API, cache, messagebus,
 *     virus-scan, temp-storage, IdP);
 *   - the discovered catalog, with the active plugin per selectable type flagged;
 *   - lazily-instantiated singleton adapters for the selectable types.
 */
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { env } from '../../config/env';
import { createPluginConfigReader, type PluginConfigReader } from '../../config/pluginConfig';
import type { FormEnginePluginDefinition } from '../form-engine/FormEnginePluginDefinition';
import type { FeatureApiDefinition } from './FeatureApiDefinition';
import type { CacheAdapter, CachePluginDefinition } from '../cache/CacheAdapter';
import type {
  MessageBusAdapter,
  MessageBusPluginDefinition,
} from '../messagebus/MessageBusAdapter';
import type { VirusScanAdapter, VirusScanPluginDefinition } from '../virus-scan/VirusScanAdapter';
import type {
  TempStorageAdapter,
  TempStoragePluginDefinition,
} from '../temp-storage/TempStorageAdapter';
import type { IdpPluginDefinition } from '../../auth/IdpPlugin';

// --- Definition schemas -----------------------------------------------------

// cache / messagebus / virus-scan / temp-storage all export the same shape.
const AdapterPluginDefinitionSchema = z.object({
  code: z.string().min(1),
  createAdapter: z.any(),
});

const FormEnginePluginDefinitionSchema = z.object({
  code: z.string().min(1),
  metadata: z.object({ code: z.string(), name: z.string(), version: z.string().optional() }),
  createAdapter: z.any(),
});

const FeatureApiDefinitionSchema = z.object({
  code: z.string().min(1),
  basePath: z.string(),
  createRouter: z.any(),
  registerOpenApi: z.any().optional(),
});

const IdpPluginDefinitionSchema = z.object({
  code: z.string().min(1),
  createAuthMiddleware: z.any(),
  createClaimMapper: z.any(),
});

// --- Discovery --------------------------------------------------------------

interface CachedPlugin {
  dir: string;
  formEngineDefinition?: FormEnginePluginDefinition;
  apiDefinition?: FeatureApiDefinition;
  cacheDefinition?: CachePluginDefinition;
  messagebusDefinition?: MessageBusPluginDefinition;
  virusScanDefinition?: VirusScanPluginDefinition;
  tempStorageDefinition?: TempStoragePluginDefinition;
  idpDefinition?: IdpPluginDefinition;
}

// Each CachedPlugin field, the module export it comes from, and the schema that
// validates it. The one place to add a new plugin kind.
const DEFINITION_KINDS: ReadonlyArray<{
  field: keyof CachedPlugin;
  exportKey: string;
  schema: z.ZodTypeAny;
}> = [
  {
    field: 'formEngineDefinition',
    exportKey: 'formEnginePluginDefinition',
    schema: FormEnginePluginDefinitionSchema,
  },
  { field: 'apiDefinition', exportKey: 'pluginApiDefinition', schema: FeatureApiDefinitionSchema },
  {
    field: 'cacheDefinition',
    exportKey: 'cachePluginDefinition',
    schema: AdapterPluginDefinitionSchema,
  },
  {
    field: 'messagebusDefinition',
    exportKey: 'messagebusPluginDefinition',
    schema: AdapterPluginDefinitionSchema,
  },
  {
    field: 'virusScanDefinition',
    exportKey: 'virusScanPluginDefinition',
    schema: AdapterPluginDefinitionSchema,
  },
  {
    field: 'tempStorageDefinition',
    exportKey: 'tempStoragePluginDefinition',
    schema: AdapterPluginDefinitionSchema,
  },
  { field: 'idpDefinition', exportKey: 'idpPluginDefinition', schema: IdpPluginDefinitionSchema },
];

let cache: CachedPlugin[] | null = null;

function getPluginsRoot(): string {
  const fromEnv = env.getPluginsPath();
  if (fromEnv) return path.resolve(fromEnv);
  // Compiled: this file is dist/src/core/integrations/plugins → ../../../plugins = dist/src/plugins.
  // Do not use process.cwd() for dist (breaks when node is started from repo root or /app).
  const runningFromDist = __dirname.includes(path.sep + 'dist' + path.sep);
  if (runningFromDist) return path.resolve(__dirname, '..', '..', '..', 'plugins');
  return path.resolve(process.cwd(), 'src', 'plugins');
}

/** Validate `obj[key]` with `schema`, returning it when valid or undefined
 *  (warning when invalid) so a malformed export is skipped rather than fatal. */
function parseDefinition(
  obj: Record<string, unknown>,
  pluginDir: string,
  key: string,
  schema: z.ZodTypeAny,
): unknown {
  const value = obj[key];
  if (value === undefined) return undefined;
  const parsed = schema.safeParse(value);
  if (parsed.success) return value;
  console.warn(`[PluginRegistry] invalid ${key} in '${pluginDir}':`, parsed.error.message);
  return undefined;
}

/** Load + validate one plugin module. Null when the module fails to load (logged);
 *  individual malformed definitions are skipped. */
function loadPlugin(pluginsRoot: string, pluginDir: string): CachedPlugin | null {
  let raw: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    raw = require(path.join(pluginsRoot, pluginDir));
  } catch (err) {
    console.warn(`[PluginRegistry] failed to load plugin '${pluginDir}':`, err);
    return null;
  }

  const obj = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const entry: CachedPlugin = { dir: pluginDir };
  // Populate the heterogeneous fields dynamically through a writable view; each
  // value's shape is guarded at runtime by its Zod schema.
  const writable = entry as unknown as Record<string, unknown>;
  for (const { field, exportKey, schema } of DEFINITION_KINDS) {
    writable[field] = parseDefinition(obj, pluginDir, exportKey, schema);
  }
  return entry;
}

function discoverAndCache(): CachedPlugin[] {
  if (cache) return cache;

  const pluginsRoot = getPluginsRoot();
  if (!fs.existsSync(pluginsRoot)) {
    cache = [];
    return cache;
  }

  const result: CachedPlugin[] = [];
  for (const entry of fs.readdirSync(pluginsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const loaded = loadPlugin(pluginsRoot, entry.name);
    if (loaded) result.push(loaded);
  }

  cache = result;
  return cache;
}

/** All present values of one definition field across discovered plugins. */
function definitionsOf<K extends keyof CachedPlugin>(field: K): NonNullable<CachedPlugin[K]>[] {
  const values = discoverAndCache().map((p) => p[field]);
  return values.filter((v): v is NonNullable<CachedPlugin[K]> => v !== undefined);
}

// --- Catalog + definition getters -------------------------------------------

export interface PluginCatalogEntry {
  code: string;
  hasApi: boolean;
  apiBasePath?: string;
}

export function getPluginCatalog(): PluginCatalogEntry[] {
  // Note: intentionally excludes idpDefinition, so IdP plugins list by their dir name.
  return discoverAndCache().map((p) => ({
    code:
      p.apiDefinition?.code ??
      p.formEngineDefinition?.code ??
      p.cacheDefinition?.code ??
      p.messagebusDefinition?.code ??
      p.virusScanDefinition?.code ??
      p.tempStorageDefinition?.code ??
      p.dir,
    hasApi: Boolean(p.apiDefinition),
    apiBasePath: p.apiDefinition?.basePath,
  }));
}

export function getEnabledPluginApiDefinitions(): FeatureApiDefinition[] {
  return definitionsOf('apiDefinition');
}

export interface FormEnginePluginCatalogEntry {
  code: string;
  name: string;
  version?: string;
}

export function getFormEnginePluginCatalog(): FormEnginePluginCatalogEntry[] {
  return getFormEnginePluginDefinitions().map((d) => ({
    code: d.code,
    name: d.metadata.name,
    version: d.metadata.version,
  }));
}

export function getFormEnginePluginDefinitions(): FormEnginePluginDefinition[] {
  return definitionsOf('formEngineDefinition');
}

export function getCachePluginDefinitions(): CachePluginDefinition[] {
  return definitionsOf('cacheDefinition');
}

export function getMessageBusPluginDefinitions(): MessageBusPluginDefinition[] {
  return definitionsOf('messagebusDefinition');
}

export function getVirusScanPluginDefinitions(): VirusScanPluginDefinition[] {
  return definitionsOf('virusScanDefinition');
}

export function getTempStoragePluginDefinitions(): TempStoragePluginDefinition[] {
  return definitionsOf('tempStorageDefinition');
}

export function getIdpPluginDefinitions(): IdpPluginDefinition[] {
  return definitionsOf('idpDefinition');
}

// --- Selectable adapters ----------------------------------------------------

/**
 * Single source of truth for which plugin code is active per selectable type.
 * The adapter getters below and the /meta/plugins "enabled" flag both resolve
 * through this, so reporting can never drift from what actually loads. Add a new
 * selectable type here once and both stay in sync.
 */
const SELECTABLE_PLUGIN_DEFAULTS = {
  cache: { label: 'cache', configured: () => env.getCacheDefaultCode(), fallback: 'cache-memory' },
  messagebus: {
    label: 'messagebus',
    configured: () => env.getMessageBusDefaultCode(),
    fallback: 'messagebus-memory',
  },
  virusScan: {
    label: 'virus-scan',
    configured: () => env.getVirusScanDefaultCode(),
    fallback: 'virusscan-noop',
  },
  tempStorage: {
    label: 'temp-storage',
    configured: () => env.getTempStorageDefaultCode(),
    fallback: 'tempstorage-os',
  },
} as const;

type SelectablePluginType = keyof typeof SELECTABLE_PLUGIN_DEFAULTS;

/** The code the registry will instantiate for a selectable plugin type. */
export function resolveActivePluginCode(type: SelectablePluginType): string {
  const { configured, fallback } = SELECTABLE_PLUGIN_DEFAULTS[type];
  return configured() ?? fallback;
}

/** Codes of the plugins actually selected across every selectable type. */
export function getActivePluginCodes(): Set<string> {
  const types = Object.keys(SELECTABLE_PLUGIN_DEFAULTS) as SelectablePluginType[];
  return new Set(types.map(resolveActivePluginCode));
}

/** Minimal shape shared by every adapter plugin definition. */
interface AdapterDefinition<T> {
  code: string;
  createAdapter: (config: PluginConfigReader) => T;
}

/**
 * A lazily-instantiated singleton getter for a selectable adapter type: resolve
 * the active code, find its definition, and construct it once — throwing a
 * helpful error listing the installed codes when none matches.
 */
function lazyAdapter<T>(
  type: SelectablePluginType,
  getDefinitions: () => AdapterDefinition<T>[],
): () => T {
  let instance: T | undefined;
  return () => {
    if (instance === undefined) {
      const code = resolveActivePluginCode(type);
      const definitions = getDefinitions();
      const definition = definitions.find((d) => d.code === code);
      if (!definition) {
        const available = definitions.map((d) => d.code).join(', ') || '<none>';
        throw new Error(
          `No ${SELECTABLE_PLUGIN_DEFAULTS[type].label} plugin is installed for code '${code}'. Available: ${available}`,
        );
      }
      instance = definition.createAdapter(createPluginConfigReader(definition.code));
    }
    return instance;
  };
}

export const getCacheAdapter = lazyAdapter<CacheAdapter>('cache', getCachePluginDefinitions);
export const getMessageBusAdapter = lazyAdapter<MessageBusAdapter>(
  'messagebus',
  getMessageBusPluginDefinitions,
);
export const getVirusScanAdapter = lazyAdapter<VirusScanAdapter>(
  'virusScan',
  getVirusScanPluginDefinitions,
);
export const getTempStorageAdapter = lazyAdapter<TempStorageAdapter>(
  'tempStorage',
  getTempStoragePluginDefinitions,
);
