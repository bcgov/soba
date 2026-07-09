/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { storagePluginDefinition } from '../../../src/plugins/local-storage';
import type { PluginConfigReader } from '../../../src/core/config/pluginConfig';

function makeConfig(basePath: string): PluginConfigReader {
  return {
    getRequired: (k: string) => {
      if (k === 'BASE_PATH') return basePath;
      throw new Error(`missing ${k}`);
    },
    getOptional: (k: string, d?: string) => {
      if (k === 'BASE_PATH') return basePath;
      return d;
    },
    getBoolean: (_k: string) => false,
    getNumber: (_k: string) => 0,
    getCsv: (_k: string) => [],
  };
}

describe('local-storage adapter', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'local-storage-test-'));
  const adapter = storagePluginDefinition.createAdapter(makeConfig(tmp));

  it('uploads, lists, gets and deletes a file', async () => {
    const result = await (adapter as any).uploadFile({
      workspaceId: 'w1',
      filename: 'hello.txt',
      buffer: Buffer.from('hello world'),
      contentType: 'text/plain',
    });
    expect(result).toHaveProperty('engineFileRef');
    const meta = await (adapter as any).getFile(result.engineFileRef);
    expect(meta).not.toBeNull();
    expect(meta.filename).toBeDefined();

    const list = await (adapter as any).listFiles('w1');
    expect(Array.isArray(list.items)).toBe(true);
    expect(list.items.length).toBeGreaterThan(0);

    await (adapter as any).deleteFile(result.engineFileRef);
    const after = await (adapter as any).getFile(result.engineFileRef);
    expect(after).toBeNull();
  });
});
