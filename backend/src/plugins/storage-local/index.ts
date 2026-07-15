import fs from 'node:fs';
import path from 'node:path';
// use fs.promises.mkdir with recursive instead of fs-extra
import type {
  StorageEngineAdapter,
  StoragePluginDefinition,
  UploadFileInput,
  UploadFileResult,
  GetFileResult,
} from '../../core/integrations/storage-engine/StorageEngineAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';

function engineRefFor(relPath: string) {
  return `local:${relPath}`;
}

function parseEngineRef(ref: string) {
  if (!ref.startsWith('local:')) return null;
  return ref.slice('local:'.length);
}

// Refs are adapter-generated, but resolve and contain them so a crafted
// `local:../..` ref can never read or delete outside basePath.
function resolveWithin(basePath: string, rel: string): string | null {
  const base = path.resolve(basePath);
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  return full;
}

function createLocalStorageAdapter(config: PluginConfigReader): StorageEngineAdapter {
  const basePath = config.getOptional('BASE_PATH') ?? './data/storage';

  async function ensureBase() {
    await fs.promises.mkdir(basePath, { recursive: true });
  }

  return {
    async readinessCheck() {
      try {
        await ensureBase();
        return { ok: true };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
    },

    async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
      await ensureBase();
      const subdir = input.workspaceId ? path.join(basePath, input.workspaceId) : basePath;
      await fs.promises.mkdir(subdir, { recursive: true });
      const filename = `${Date.now()}-${input.workspaceId}-${path.basename(
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
        throw new Error('sourceUrl uploads are not supported by storage-local adapter');
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
      const full = resolveWithin(basePath, rel);
      if (!full) return null;
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
      const full = resolveWithin(basePath, rel);
      if (!full) return;
      try {
        await fs.promises.unlink(full);
      } catch {
        // ignore
      }
    },
  };
}

export const storagePluginDefinition: StoragePluginDefinition = {
  code: 'storage-local',
  createAdapter: createLocalStorageAdapter,
};
