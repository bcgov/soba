import { env } from './env';

const normalizeKey = (value: string): string =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');

const getRequiredBoolean = (envKey: string): boolean => {
  const value = env.getRequiredEnv(envKey).trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${envKey} must be 'true' or 'false'`);
};

const getRequiredNumber = (envKey: string): number => {
  const value = env.getRequiredEnv(envKey);
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${envKey} must be a number`);
  }
  return parsed;
};

const getRequiredCsv = (envKey: string): string[] => {
  const raw = env.getRequiredEnv(envKey);
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export interface PluginConfigReader {
  getRequired(key: string): string;
  getOptional(key: string, defaultValue?: string): string | undefined;
  getBoolean(key: string): boolean;
  getNumber(key: string): number;
  getCsv(key: string): string[];
}

export const createPluginConfigReader = (pluginCode: string): PluginConfigReader => {
  const prefix = `PLUGIN_${normalizeKey(pluginCode)}_`;
  const toEnvKey = (key: string) => `${prefix}${normalizeKey(key)}`;

  return {
    getRequired: (key: string) => env.getRequiredEnv(toEnvKey(key)),
    getOptional: (key: string, defaultValue?: string) =>
      env.getOptionalEnv(toEnvKey(key)) ?? defaultValue,
    getBoolean: (key: string) => getRequiredBoolean(toEnvKey(key)),
    getNumber: (key: string) => getRequiredNumber(toEnvKey(key)),
    getCsv: (key: string) => getRequiredCsv(toEnvKey(key)),
  };
};
