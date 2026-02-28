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

const getOptionalEnv = (key: string, defaultValue?: string): string | undefined => {
  const value = process.env[key];
  return value ?? defaultValue;
};

const getBooleanEnv = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (value === undefined || value === '') return defaultValue;
  return value.trim().toLowerCase() === 'true';
};

const getNumberEnv = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${key} must be a number`);
  }
  return parsed;
};

const getCsvEnv = (key: string, defaultValue: string[]): string[] => {
  const raw = getOptionalEnv(key);
  if (!raw) return defaultValue;
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
  getDbAdminDatabase: () => getOptionalEnv('DB_ADMIN_DATABASE', 'postgres') as string,
  getOutboxPollIntervalMs: () => getNumberEnv('OUTBOX_POLL_INTERVAL_MS', 5000),
  getSystemSobaUserId: () => getOptionalEnv('SYSTEM_SOBA_USER_ID'),
  getWorkspacePluginsEnabled: () => getRequiredEnv('WORKSPACE_PLUGINS_ENABLED'),
  getWorkspacePluginsStrictModeRaw: () => getRequiredEnv('WORKSPACE_PLUGINS_STRICT_MODE'),
  getFormioVersion: () => getOptionalEnv('FORMIO_VERSION', 'unknown') as string,
  getFormioBaseUrl: () => getOptionalEnv('FORMIO_BASE_URL', '') as string,
  getFormioAdminUsername: () => getOptionalEnv('FORMIO_ADMIN_USERNAME', '') as string,
  getFormioAdminPassword: () => getOptionalEnv('FORMIO_ADMIN_PASSWORD', '') as string,
  getFormioManagerUsername: () => getOptionalEnv('FORMIO_MANAGER_USERNAME', '') as string,
  getFormioManagerPassword: () => getOptionalEnv('FORMIO_MANAGER_PASSWORD', '') as string,
  getJwksUri: () => getRequiredEnv('JWKS_URI'),
  getJwtIssuer: () => getRequiredEnv('JWT_ISSUER'),
  getJwtAudience: () => getOptionalEnv('JWT_AUDIENCE'),
  getRoleField: () => getOptionalEnv('ROLE_FIELD', 'Role') as string,
  getAdminRoleName: () => getOptionalEnv('ADMIN_ROLE_NAME', 'Admin') as string,
  getManagerRoleName: () => getOptionalEnv('MANAGER_ROLE_NAME', 'Manager') as string,
  isDevelopment: () => getOptionalEnv('NODE_ENV', 'development') === 'development',
  getSessionSecret: () => getOptionalEnv('SESSION_SECRET', 'dev-session-secret') as string,
};
