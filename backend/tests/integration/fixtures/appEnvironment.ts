// This import loads local dotenv files first. Pin settings before importing the application,
// whose rate limiters and auth registries capture settings during module initialization.
import { env } from '../../../src/core/config/env';
env.loadEnv();

const settings = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  API_BASE_PATH: '/chefs',
  TRUST_PROXY_HOPS: '0',
  RATE_LIMIT_WINDOW_MS: '60000',
  RATE_LIMIT_MAX: '1000',
  RATE_LIMIT_API_WINDOW_MS: '60000',
  RATE_LIMIT_API_MAX: '1000',
  RATE_LIMIT_PUBLIC_WINDOW_MS: '60000',
  RATE_LIMIT_PUBLIC_MAX: '1000',
  CORS_ORIGIN: 'https://integration-client.example.test',
};
const original = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
Object.assign(process.env, settings);

export const restoreAppTestEnvironment = () => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};
