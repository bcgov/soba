const path = require('path');
const dotenv = require('dotenv');

// Ensure dotenv does not log "injecting env" and tips when running tests.
process.env.DOTENV_CONFIG_QUIET = 'true';

// Silence app logging (pino) during tests so supertest error-handler tests don't dump JSON to stdout.
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

const backendRoot = __dirname;

// Match app bootstrap: local .env wins when present (devcontainer), then fill gaps for CI.
dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });
dotenv.config({ path: path.join(backendRoot, '.env.local'), override: true, quiet: true });

/** @param {string} key @param {string} value */
function setDefaultEnv(key, value) {
  if (process.env[key] === undefined || process.env[key] === '') {
    process.env[key] = value;
  }
}

setDefaultEnv('NODE_ENV', 'test');
// Unit tests mock repos; no live DB connection is required at import time.
// Ensure no tests depend on active/running infrastructure (e.g. database, Redis, etc.).
setDefaultEnv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/soba_test');
setDefaultEnv('WORKSPACE_PLUGINS_ALLOWED', 'enterprise-cstar,personal-local');
setDefaultEnv('WORKSPACE_PLUGINS_STRICT_MODE', 'false');
setDefaultEnv('IDP_PLUGIN_DEFAULT_SSO_JWKS_URI', 'https://example.test/jwks');
setDefaultEnv('IDP_PLUGIN_DEFAULT_SSO_JWT_ISSUER', 'https://example.test/realms/test');
setDefaultEnv('IDP_PLUGIN_DEFAULT_SSO_JWT_AUDIENCE', 'test-client');
