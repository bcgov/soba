import {
  parseBooleanEnvValue,
  parseNumberEnvValue,
  parseCsvValue,
  createEnvReader,
} from '../../../src/core/config/env';

describe('env', () => {
  it('parseBooleanEnvValue returns true for "true"', () => {
    expect(parseBooleanEnvValue('true')).toBe(true);
  });

  it('parseBooleanEnvValue returns true for "TRUE" and "  true  "', () => {
    expect(parseBooleanEnvValue('TRUE')).toBe(true);
    expect(parseBooleanEnvValue('  true  ')).toBe(true);
  });

  it('parseBooleanEnvValue returns false for "false"', () => {
    expect(parseBooleanEnvValue('false')).toBe(false);
  });

  it('parseBooleanEnvValue returns false for "False" and "  false  "', () => {
    expect(parseBooleanEnvValue('False')).toBe(false);
    expect(parseBooleanEnvValue('  false  ')).toBe(false);
  });

  it('parseBooleanEnvValue throws for non-boolean string', () => {
    expect(() => parseBooleanEnvValue('yes')).toThrow(/true.*false/);
    expect(() => parseBooleanEnvValue('1')).toThrow();
  });

  it('parseNumberEnvValue returns number for numeric string', () => {
    expect(parseNumberEnvValue('42')).toBe(42);
    expect(parseNumberEnvValue('0')).toBe(0);
  });

  it('parseNumberEnvValue throws for non-numeric string', () => {
    expect(() => parseNumberEnvValue('abc')).toThrow(/number/);
  });

  it('parseNumberEnvValue returns 0 for empty string', () => {
    expect(parseNumberEnvValue('')).toBe(0);
  });

  it('parseCsvValue splits and trims comma-separated values', () => {
    expect(parseCsvValue('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('parseCsvValue trims spaces around items', () => {
    expect(parseCsvValue(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });

  it('parseCsvValue filters empty segments', () => {
    expect(parseCsvValue('a,,b')).toEqual(['a', 'b']);
  });

  it('parseCsvValue returns empty array for empty string', () => {
    expect(parseCsvValue('')).toEqual([]);
  });

  it('createEnvReader getRequiredEnv returns value when key is set', () => {
    const reader = createEnvReader({ FOO: 'bar' });
    expect(reader.getRequiredEnv('FOO')).toBe('bar');
  });

  it('createEnvReader getRequiredEnv throws when key is missing', () => {
    const reader = createEnvReader({});
    expect(() => reader.getRequiredEnv('MISSING')).toThrow('MISSING is required');
  });

  it('createEnvReader getRequiredEnv throws when key is empty string', () => {
    const reader = createEnvReader({ EMPTY: '' });
    expect(() => reader.getRequiredEnv('EMPTY')).toThrow('EMPTY is required');
  });

  it('createEnvReader getOptionalEnv returns undefined when key is missing', () => {
    const reader = createEnvReader({});
    expect(reader.getOptionalEnv('MISSING')).toBeUndefined();
  });

  it('createEnvReader getOptionalEnv returns value when key is set', () => {
    const reader = createEnvReader({ OPT: 'value' });
    expect(reader.getOptionalEnv('OPT')).toBe('value');
  });

  it('createEnvReader getOptionalEnv returns undefined when key is empty string', () => {
    const reader = createEnvReader({ EMPTY: '' });
    expect(reader.getOptionalEnv('EMPTY')).toBeUndefined();
  });

  it('createEnvReader getBooleanEnv returns true/false/undefined from simulated env', () => {
    const reader = createEnvReader({ B1: 'true', B2: 'false' });
    expect(reader.getBooleanEnv('B1')).toBe(true);
    expect(reader.getBooleanEnv('B2')).toBe(false);
    expect(reader.getBooleanEnv('MISSING')).toBeUndefined();
  });

  it('createEnvReader getNumberEnv returns number or undefined from simulated env', () => {
    const reader = createEnvReader({ N: '42' });
    expect(reader.getNumberEnv('N')).toBe(42);
    expect(reader.getNumberEnv('MISSING')).toBeUndefined();
  });

  it('createEnvReader getCsvEnv returns trimmed array or undefined from simulated env', () => {
    const reader = createEnvReader({ CSV: 'a, b , c' });
    expect(reader.getCsvEnv('CSV')).toEqual(['a', 'b', 'c']);
    expect(reader.getCsvEnv('MISSING')).toBeUndefined();
  });

  it('createEnvReader getDatabaseUrl returns DATABASE_URL from simulated env', () => {
    const reader = createEnvReader({ DATABASE_URL: 'postgres://localhost/db' });
    expect(reader.getDatabaseUrl()).toBe('postgres://localhost/db');
  });

  it('createEnvReader getWorkspacePluginsEnabled returns required value from simulated env', () => {
    const reader = createEnvReader({ WORKSPACE_PLUGINS_ENABLED: 'personal-local' });
    expect(reader.getWorkspacePluginsEnabled()).toBe('personal-local');
  });

  it('createEnvReader getWorkspacePluginsStrictModeRaw returns value from simulated env', () => {
    const reader = createEnvReader({ WORKSPACE_PLUGINS_STRICT_MODE: 'false' });
    expect(reader.getWorkspacePluginsStrictModeRaw()).toBe('false');
  });

  it('createEnvReader isDevelopment returns true when NODE_ENV is development', () => {
    const reader = createEnvReader({ NODE_ENV: 'development' });
    expect(reader.isDevelopment()).toBe(true);
  });

  it('createEnvReader isDevelopment returns false when NODE_ENV is production', () => {
    const reader = createEnvReader({ NODE_ENV: 'production' });
    expect(reader.isDevelopment()).toBe(false);
  });

  it('createEnvReader getPluginsPath prefers PLUGINS_PATH over WORKSPACE_PLUGINS_PATH', () => {
    const reader = createEnvReader({
      PLUGINS_PATH: '/plugins',
      WORKSPACE_PLUGINS_PATH: '/other',
    });
    expect(reader.getPluginsPath()).toBe('/plugins');
  });

  it('createEnvReader getPluginsPath falls back to WORKSPACE_PLUGINS_PATH when PLUGINS_PATH missing', () => {
    const reader = createEnvReader({ WORKSPACE_PLUGINS_PATH: '/fallback' });
    expect(reader.getPluginsPath()).toBe('/fallback');
  });

  it('createEnvReader getOutboxPollIntervalMs and getOutboxBatchSize return numbers from simulated env', () => {
    const reader = createEnvReader({
      OUTBOX_POLL_INTERVAL_MS: '5000',
      OUTBOX_BATCH_SIZE: '10',
    });
    expect(reader.getOutboxPollIntervalMs()).toBe(5000);
    expect(reader.getOutboxBatchSize()).toBe(10);
  });
});
