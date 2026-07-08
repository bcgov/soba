/**
 * Shared disk-backed TempStorageAdapter used by the tempstorage-os and
 * tempstorage-mount plugins. The only difference between them is the base
 * directory, so the logic lives here once.
 */
import { randomUUID } from 'crypto';
import { createReadStream as fsCreateReadStream, createWriteStream, mkdirSync } from 'fs';
import { rm } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import type { TempResource, TempStorageAdapter, TempWriteOptions } from './TempStorageAdapter';

export function createDiskTempStorageAdapter(baseDir: string): TempStorageAdapter {
  const root = path.resolve(baseDir);
  let ensured = false;
  const ensureRoot = (): void => {
    if (!ensured) {
      mkdirSync(root, { recursive: true });
      ensured = true;
    }
  };

  const adapter: TempStorageAdapter = {
    async write(data: Buffer | Readable, opts?: TempWriteOptions): Promise<TempResource> {
      ensureRoot();
      const id = randomUUID();
      const filePath = path.join(root, `${opts?.prefix ?? 'soba'}-${id}`);
      const source = Buffer.isBuffer(data) ? Readable.from(data) : data;
      await pipeline(source, createWriteStream(filePath));
      return { id, path: filePath };
    },

    createReadStream(resource: TempResource): Readable {
      return fsCreateReadStream(resource.path);
    },

    async remove(resource: TempResource): Promise<void> {
      await rm(resource.path, { force: true });
    },

    async ping(): Promise<boolean> {
      try {
        const resource = await adapter.write(Buffer.from('ok'), { prefix: 'healthcheck' });
        await adapter.remove(resource);
        return true;
      } catch {
        return false;
      }
    },
  };

  return adapter;
}
