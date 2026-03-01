import dotenv from 'dotenv';

let loaded = false;

// Load process env once per process: base first, then local overrides.
export const loadEnv = () => {
  if (loaded) return;
  const quiet = process.env.NODE_ENV === 'test';
  dotenv.config({ path: '.env', quiet });
  dotenv.config({ path: '.env.local', override: true, quiet });
  loaded = true;
};

// Ensure env is initialized as soon as this module is imported.
loadEnv();

/** Pure parser: "true"/"false" (trimmed, case-insensitive) → boolean. Throws otherwise. */
export function parseBooleanEnvValue(value: string): boolean {
  const lower = value.trim().toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  throw new Error("Value must be 'true' or 'false'");
}

/** Pure parser: string → number. Throws if not a valid number. */
export function parseNumberEnvValue(value: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error('Value must be a number');
  }
  return parsed;
}

/** Pure parser: comma-separated string → trimmed non-empty strings. */
export function parseCsvValue(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Environment key/value source (e.g. process.env or a simulated object for tests). */
export type EnvSource = Record<string, string | undefined>;

function getRequiredEnvFrom(source: EnvSource, key: string): string {
  const value = source[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function getOptionalEnvFrom(source: EnvSource, key: string): string | undefined {
  const value = source[key];
  return value !== undefined && value !== '' ? value : undefined;
}

function getBooleanEnvFrom(source: EnvSource, key: string): boolean | undefined {
  const value = source[key];
  if (value === undefined || value === '') return undefined;
  return parseBooleanEnvValue(value);
}

function getNumberEnvFrom(source: EnvSource, key: string): number | undefined {
  const value = source[key];
  if (value === undefined || value === '') return undefined;
  return parseNumberEnvValue(value);
}

function getCsvEnvFrom(source: EnvSource, key: string): string[] | undefined {
  const raw = getOptionalEnvFrom(source, key);
  if (!raw) return undefined;
  return parseCsvValue(raw);
}

/** Build an env reader that reads from the given source. Use in tests with a simulated .env object. */
export function createEnvReader(source: EnvSource) {
  return {
    loadEnv,
    getRequiredEnv: (key: string) => getRequiredEnvFrom(source, key),
    getOptionalEnv: (key: string) => getOptionalEnvFrom(source, key),
    getBooleanEnv: (key: string) => getBooleanEnvFrom(source, key),
    getNumberEnv: (key: string) => getNumberEnvFrom(source, key),
    getCsvEnv: (key: string) => getCsvEnvFrom(source, key),
    getDatabaseUrl: () => getRequiredEnvFrom(source, 'DATABASE_URL'),
    getDbAdminDatabase: () => getOptionalEnvFrom(source, 'DB_ADMIN_DATABASE'),
    getOutboxPollIntervalMs: () => getNumberEnvFrom(source, 'OUTBOX_POLL_INTERVAL_MS'),
    getOutboxBatchSize: () => getNumberEnvFrom(source, 'OUTBOX_BATCH_SIZE'),
    getSystemSobaUserEmail: () => getOptionalEnvFrom(source, 'SYSTEM_SOBA_USER_EMAIL'),
    getSystemSobaSubject: () => getOptionalEnvFrom(source, 'SOBA_SYSTEM_SUBJECT'),
    getWorkspacePluginsEnabled: () => getRequiredEnvFrom(source, 'WORKSPACE_PLUGINS_ENABLED'),
    getWorkspacePluginsStrictModeRaw: () =>
      getRequiredEnvFrom(source, 'WORKSPACE_PLUGINS_STRICT_MODE'),
    getFormioVersion: () => getOptionalEnvFrom(source, 'FORMIO_VERSION'),
    getFormioBaseUrl: () => getOptionalEnvFrom(source, 'FORMIO_BASE_URL'),
    getFormioAdminUsername: () => getOptionalEnvFrom(source, 'FORMIO_ADMIN_USERNAME'),
    getFormioAdminPassword: () => getOptionalEnvFrom(source, 'FORMIO_ADMIN_PASSWORD'),
    getFormioManagerUsername: () => getOptionalEnvFrom(source, 'FORMIO_MANAGER_USERNAME'),
    getFormioManagerPassword: () => getOptionalEnvFrom(source, 'FORMIO_MANAGER_PASSWORD'),
    getJwksUri: () => getRequiredEnvFrom(source, 'JWKS_URI'),
    getJwtIssuer: () => getRequiredEnvFrom(source, 'JWT_ISSUER'),
    getJwtAudience: () => getOptionalEnvFrom(source, 'JWT_AUDIENCE'),
    getRoleField: () => getOptionalEnvFrom(source, 'ROLE_FIELD'),
    getAdminRoleName: () => getOptionalEnvFrom(source, 'ADMIN_ROLE_NAME'),
    getManagerRoleName: () => getOptionalEnvFrom(source, 'MANAGER_ROLE_NAME'),
    isDevelopment: () => getOptionalEnvFrom(source, 'NODE_ENV') === 'development',
    getSessionSecret: () => getOptionalEnvFrom(source, 'SESSION_SECRET'),
    getPluginsPath: () =>
      getOptionalEnvFrom(source, 'PLUGINS_PATH') ??
      getOptionalEnvFrom(source, 'WORKSPACE_PLUGINS_PATH'),
    getCacheDefaultCode: () => getOptionalEnvFrom(source, 'CACHE_DEFAULT_CODE'),
    getMessageBusDefaultCode: () => getOptionalEnvFrom(source, 'MESSAGEBUS_DEFAULT_CODE'),
    getFormEngineDefaultCode: () => getOptionalEnvFrom(source, 'FORM_ENGINE_DEFAULT_CODE'),
  };
}

export type EnvReader = ReturnType<typeof createEnvReader>;

const getRequiredEnv = (key: string): string => getRequiredEnvFrom(process.env, key);
const getOptionalEnv = (key: string): string | undefined => getOptionalEnvFrom(process.env, key);
const getBooleanEnv = (key: string): boolean | undefined => getBooleanEnvFrom(process.env, key);
const getNumberEnv = (key: string): number | undefined => getNumberEnvFrom(process.env, key);
const getCsvEnv = (key: string): string[] | undefined => getCsvEnvFrom(process.env, key);

export const env = {
  loadEnv,
  getRequiredEnv,
  getOptionalEnv,
  getBooleanEnv,
  getNumberEnv,
  getCsvEnv,
  getDatabaseUrl: () => getRequiredEnv('DATABASE_URL'),
  getDbAdminDatabase: () => getOptionalEnv('DB_ADMIN_DATABASE'),
  getOutboxPollIntervalMs: () => getNumberEnv('OUTBOX_POLL_INTERVAL_MS'),
  getOutboxBatchSize: () => getNumberEnv('OUTBOX_BATCH_SIZE'),
  getSystemSobaUserEmail: () => getOptionalEnv('SYSTEM_SOBA_USER_EMAIL'),
  /** Subject for the system SOBA user identity (provider=system). Default in code: soba-system. */
  getSystemSobaSubject: () => getOptionalEnv('SOBA_SYSTEM_SUBJECT'),
  getWorkspacePluginsEnabled: () => getRequiredEnv('WORKSPACE_PLUGINS_ENABLED'),
  getWorkspacePluginsStrictModeRaw: () => getRequiredEnv('WORKSPACE_PLUGINS_STRICT_MODE'),
  getFormioVersion: () => getOptionalEnv('FORMIO_VERSION'),
  getFormioBaseUrl: () => getOptionalEnv('FORMIO_BASE_URL'),
  getFormioAdminUsername: () => getOptionalEnv('FORMIO_ADMIN_USERNAME'),
  getFormioAdminPassword: () => getOptionalEnv('FORMIO_ADMIN_PASSWORD'),
  getFormioManagerUsername: () => getOptionalEnv('FORMIO_MANAGER_USERNAME'),
  getFormioManagerPassword: () => getOptionalEnv('FORMIO_MANAGER_PASSWORD'),
  getJwksUri: () => getRequiredEnv('JWKS_URI'),
  getJwtIssuer: () => getRequiredEnv('JWT_ISSUER'),
  getJwtAudience: () => getOptionalEnv('JWT_AUDIENCE'),
  getRoleField: () => getOptionalEnv('ROLE_FIELD'),
  getAdminRoleName: () => getOptionalEnv('ADMIN_ROLE_NAME'),
  getManagerRoleName: () => getOptionalEnv('MANAGER_ROLE_NAME'),
  isDevelopment: () => getOptionalEnv('NODE_ENV') === 'development',
  getSessionSecret: () => getOptionalEnv('SESSION_SECRET'),
  getPluginsPath: () => getOptionalEnv('PLUGINS_PATH') ?? getOptionalEnv('WORKSPACE_PLUGINS_PATH'),
  getCacheDefaultCode: () => getOptionalEnv('CACHE_DEFAULT_CODE'),
  getMessageBusDefaultCode: () => getOptionalEnv('MESSAGEBUS_DEFAULT_CODE'),
  getFormEngineDefaultCode: () => getOptionalEnv('FORM_ENGINE_DEFAULT_CODE'),
};
