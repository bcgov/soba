import { normalizeKey, createPluginConfigReaderFrom } from '../../../src/core/config/pluginConfig';
import { createEnvReader } from '../../../src/core/config/env';

describe('pluginConfig', () => {
  it('normalizeKey uppercases and replaces non-alphanumeric with underscore', () => {
    expect(normalizeKey('foo')).toBe('FOO');
    expect(normalizeKey('foo-bar')).toBe('FOO_BAR');
  });

  it('normalizeKey trims whitespace', () => {
    expect(normalizeKey('  foo  ')).toBe('FOO');
  });

  it('normalizeKey replaces multiple separators with single underscore', () => {
    expect(normalizeKey('foo-bar-baz')).toBe('FOO_BAR_BAZ');
    expect(normalizeKey('foo.bar.baz')).toBe('FOO_BAR_BAZ');
  });

  it('normalizeKey keeps digits', () => {
    expect(normalizeKey('plugin1')).toBe('PLUGIN1');
  });

  it('createPluginConfigReaderFrom reads plugin-prefixed keys from simulated env', () => {
    const reader = createEnvReader({
      PLUGIN_MY_PLUGIN_API_URL: 'https://api.example.com',
      PLUGIN_MY_PLUGIN_ENABLED: 'true',
      PLUGIN_MY_PLUGIN_TIMEOUT: '5000',
      PLUGIN_MY_PLUGIN_SCOPES: 'read, write',
    });
    const config = createPluginConfigReaderFrom(reader, 'my-plugin');
    expect(config.getRequired('api_url')).toBe('https://api.example.com');
    expect(config.getBoolean('enabled')).toBe(true);
    expect(config.getNumber('timeout')).toBe(5000);
    expect(config.getCsv('scopes')).toEqual(['read', 'write']);
  });

  it('createPluginConfigReaderFrom getOptional returns defaultValue when key missing', () => {
    const reader = createEnvReader({});
    const config = createPluginConfigReaderFrom(reader, 'my-plugin');
    expect(config.getOptional('missing', 'default')).toBe('default');
  });

  it('createPluginConfigReaderFrom getRequired throws when plugin key missing', () => {
    const reader = createEnvReader({});
    const config = createPluginConfigReaderFrom(reader, 'other-plugin');
    expect(() => config.getRequired('api_url')).toThrow(/PLUGIN_OTHER_PLUGIN_API_URL is required/);
  });

  it('createPluginConfigReaderFrom normalizes plugin code and key to env name', () => {
    const reader = createEnvReader({
      PLUGIN_PERSONAL_LOCAL_BASE_URL: 'http://local',
    });
    const config = createPluginConfigReaderFrom(reader, 'personal-local');
    expect(config.getRequired('base_url')).toBe('http://local');
  });
});
