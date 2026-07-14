import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { createEnvReader } from '../../../src/core/config/env';
import { createPluginConfigReaderFrom } from '../../../src/core/config/pluginConfig';
import { tempStoragePluginDefinition } from '../../../src/plugins/tempstorage-os';

describe('tempstorage-os', () => {
  it('has the expected code', () => {
    expect(tempStoragePluginDefinition.code).toBe('tempstorage-os');
  });

  it('writes under os.tmpdir()/<SUBDIR> and exposes a real path', async () => {
    const subdir = `soba-os-test-${randomUUID()}`;
    const config = createPluginConfigReaderFrom(
      createEnvReader({ PLUGIN_TEMPSTORAGE_OS_SUBDIR: subdir }),
      'tempstorage-os',
    );
    const adapter = tempStoragePluginDefinition.createAdapter(config);
    const resource = await adapter.write(Buffer.from('disk'));
    try {
      expect(resource.path).not.toBeNull();
      expect(resource.path.startsWith(path.join(os.tmpdir(), subdir))).toBe(true);
      expect(fs.readFileSync(resource.path, 'utf8')).toBe('disk');
    } finally {
      fs.rmSync(path.join(os.tmpdir(), subdir), { recursive: true, force: true });
    }
  });
});
