import dotenv from 'dotenv';

let loaded = false;

// Load process env once per process: base first, then local overrides.
export const loadEnv = () => {
  if (loaded) return;
  dotenv.config({ path: '.env' });
  dotenv.config({ path: '.env.local', override: true });
  loaded = true;
};

// Ensure env is initialized as soon as this module is imported.
loadEnv();

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
};

const getOptionalEnv = (key: string): string | undefined => {
  const value = process.env[key];
  return value !== undefined && value !== '' ? value : undefined;
};

const getBooleanEnv = (key: string): boolean | undefined => {
  const value = process.env[key];
  if (value === undefined || value === '') return undefined;
  const lower = value.trim().toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  throw new Error(`${key} must be 'true' or 'false'`);
};

const getNumberEnv = (key: string): number | undefined => {
  const value = process.env[key];
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${key} must be a number`);
  }
  return parsed;
};

const getCsvEnv = (key: string): string[] | undefined => {
  const raw = getOptionalEnv(key);
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

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
