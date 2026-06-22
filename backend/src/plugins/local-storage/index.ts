/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
// use fs.promises.mkdir with recursive instead of fs-extra
import type {
  StorageEngineAdapter,
  UploadFileInput,
  UploadFileResult,
  GetFileResult,
  ListFilesResult,
} from '../../core/integrations/storage-engine/StorageEngineAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';

function createLocalStorageAdapter(config: PluginConfigReader): StorageEngineAdapter {
  const basePath = config.getOptional('BASE_PATH') ?? './data/storage';

  async function ensureBase() {
    await fs.promises.mkdir(basePath, { recursive: true });
  }

  function engineRefFor(relPath: string) {
    return `local:${relPath}`;
  }

  function parseEngineRef(ref: string) {
    if (!ref.startsWith('local:')) return null;
    return ref.slice('local:'.length);
  }

  return {
    async readinessCheck() {
      try {
        await ensureBase();
        return { ok: true };
      } catch (err: any) {
        return { ok: false, message: String(err?.message ?? err) };
      }
    },

    async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
      await ensureBase();
      const subdir = input.workspaceId ? path.join(basePath, input.workspaceId) : basePath;
      await fs.promises.mkdir(subdir, { recursive: true });
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${path.basename(
        input.filename || 'file',
      )}`;
      const dest = path.join(subdir, filename);

      if (input.buffer) {
        await fs.promises.writeFile(dest, input.buffer);
      } else if (input.stream) {
        const out = fs.createWriteStream(dest);
        await new Promise<void>((resolve, reject) => {
          input.stream!.pipe(out);
          out.on('finish', () => resolve());
          out.on('error', (e) => reject(e));
        });
      } else if (input.sourceUrl) {
        // sourceUrl ingestion is not implemented in this adapter.
        throw new Error('sourceUrl uploads are not supported by local-storage adapter');
      } else {
        throw new Error('No payload provided');
      }
      await fs.promises.stat(dest);
      return {
        engineFileRef: engineRefFor(path.relative(basePath, dest)),
        publicUrl: undefined,
        metadata: { filename: input.filename },
      };
    },

    async getFile(engineFileRef: string): Promise<GetFileResult | null> {
      const rel = parseEngineRef(engineFileRef);
      if (!rel) return null;
      const full = path.join(basePath, rel);
      try {
        const stats = await fs.promises.stat(full);
        return {
          engineFileRef,
          filename: path.basename(full),
          contentType: undefined,
          size: stats.size,
          createdAt: stats.ctime.toISOString(),
          downloadStream: fs.createReadStream(full),
        };
      } catch {
        return null;
      }
    },

    async deleteFile(engineFileRef: string): Promise<void> {
      const rel = parseEngineRef(engineFileRef);
      if (!rel) return;
      const full = path.join(basePath, rel);
      try {
        await fs.promises.unlink(full);
      } catch {
        // ignore
      }
    },

    async listFiles(workspaceId: string): Promise<ListFilesResult> {
      const dir = workspaceId ? path.join(basePath, workspaceId) : basePath;
      try {
        const entries = await fs.promises.readdir(dir);
        const items = await Promise.all(
          entries.map(async (e) => {
            const full = path.join(dir, e);
            const stats = await fs.promises.stat(full);
            return {
              engineFileRef: engineRefFor(path.relative(basePath, full)),
              filename: e,
              size: stats.size,
              createdAt: stats.ctime.toISOString(),
            };
          }),
        );
        return { items };
      } catch {
        return { items: [] };
      }
    },
  };
}

export const storagePluginDefinition = {
  code: 'local-storage',
  createAdapter: createLocalStorageAdapter,
};
