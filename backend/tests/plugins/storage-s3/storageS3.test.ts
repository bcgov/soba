import { storagePluginDefinition } from '../../../src/plugins/storage-s3';
import type { PluginConfigReader } from '../../../src/core/config/pluginConfig';

function makeConfig(values: Record<string, string>): PluginConfigReader {
  return {
    getRequired: (k: string) => {
      if (values[k] === undefined) throw new Error(`missing ${k}`);
      return values[k];
    },
    getOptional: (k: string, d?: string) => values[k] ?? d,
    getBoolean: () => false,
    getNumber: () => 0,
    getOptionalNumber: () => undefined,
    getCsv: () => [],
  };
}

const base = {
  ENDPOINT: 'http://localhost:9000',
  ACCESS_KEY: 'access',
  SECRET_KEY: 'secret',
  BUCKET_NAME: 'bucket',
};

describe('storage-s3 adapter', () => {
  it.each(['soba/dev', 'dev'])('accepts the root prefix %s', (prefix) => {
    expect(() =>
      storagePluginDefinition.createAdapter(makeConfig({ ...base, PREFIX: prefix })),
    ).not.toThrow();
  });

  it.each(['Dev', 'dev/', '/dev', '../dev'])('refuses the root prefix %j', (prefix) => {
    expect(() =>
      storagePluginDefinition.createAdapter(makeConfig({ ...base, PREFIX: prefix })),
    ).toThrow(`Invalid storage profile PREFIX '${prefix}'`);
  });
});
