import {
  env,
  parseBooleanEnvValue,
  parseNumberEnvValue,
  parseCsvValue,
  type EnvReader,
} from './env';

/** Normalize a key for env: trim, uppercase, replace non-alphanumeric with underscore. */
export const normalizeKey = (value: string): string =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');

/** Minimal env reader interface for plugin config (e.g. from createEnvReader). */
export type PluginConfigEnvReader = Pick<EnvReader, 'getRequiredEnv' | 'getOptionalEnv'>;

const getRequiredBoolean = (reader: PluginConfigEnvReader, envKey: string): boolean => {
  return parseBooleanEnvValue(reader.getRequiredEnv(envKey));
};

const getRequiredNumber = (reader: PluginConfigEnvReader, envKey: string): number => {
  return parseNumberEnvValue(reader.getRequiredEnv(envKey));
};

const getRequiredCsv = (reader: PluginConfigEnvReader, envKey: string): string[] => {
  return parseCsvValue(reader.getRequiredEnv(envKey));
};

export interface PluginConfigReader {
  getRequired(key: string): string;
  getOptional(key: string, defaultValue?: string): string | undefined;
  getBoolean(key: string): boolean;
  getNumber(key: string): number;
  getCsv(key: string): string[];
}

export function createPluginConfigReaderFrom(
  reader: PluginConfigEnvReader,
  pluginCode: string,
): PluginConfigReader {
  const prefix = `PLUGIN_${normalizeKey(pluginCode)}_`;
  const toEnvKey = (key: string) => `${prefix}${normalizeKey(key)}`;

  return {
    getRequired: (key: string) => reader.getRequiredEnv(toEnvKey(key)),
    getOptional: (key: string, defaultValue?: string) =>
      reader.getOptionalEnv(toEnvKey(key)) ?? defaultValue,
    getBoolean: (key: string) => getRequiredBoolean(reader, toEnvKey(key)),
    getNumber: (key: string) => getRequiredNumber(reader, toEnvKey(key)),
    getCsv: (key: string) => getRequiredCsv(reader, toEnvKey(key)),
  };
}

export const createPluginConfigReader = (pluginCode: string): PluginConfigReader => {
  return createPluginConfigReaderFrom(env, pluginCode);
};
