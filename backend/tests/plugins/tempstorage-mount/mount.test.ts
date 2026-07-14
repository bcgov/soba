import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { createEnvReader } from '../../../src/core/config/env';
import { createPluginConfigReaderFrom } from '../../../src/core/config/pluginConfig';
import { tempStoragePluginDefinition } from '../../../src/plugins/tempstorage-mount';

describe('tempstorage-mount', () => {
  it('has the expected code', () => {
    expect(tempStoragePluginDefinition.code).toBe('tempstorage-mount');
  });

  it('writes under the configured DIR and exposes a real path', async () => {
    const dir = path.join(os.tmpdir(), `soba-mount-test-${randomUUID()}`);
    const config = createPluginConfigReaderFrom(
      createEnvReader({ PLUGIN_TEMPSTORAGE_MOUNT_DIR: dir }),
      'tempstorage-mount',
    );
    const adapter = tempStoragePluginDefinition.createAdapter(config);
    const resource = await adapter.write(Buffer.from('mounted'));
    try {
      expect(resource.path).not.toBeNull();
      expect(path.dirname(resource.path)).toBe(path.resolve(dir));
      expect(fs.readFileSync(resource.path, 'utf8')).toBe('mounted');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
