import * as Minio from 'minio';
import { Readable } from 'node:stream';
import type {
  StorageEngineAdapter,
  StoragePluginDefinition,
  UploadFileInput,
  UploadFileResult,
  GetFileResult,
} from '../../core/integrations/storage-engine/StorageEngineAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';
import { isStoragePrefix } from '../../core/integrations/storage-engine/storageKey';
import { log } from '../../core/logging';
import { objectKey, ownedKey } from './objectKey';

const CODE = 'storage-s3';

/**
 * S3-compatible (MinIO) storage plugin adapter.
 *
 * Config is read per storage profile, so keys use the STORAGE_PROFILE_<PROFILE>_ prefix
 * (e.g. STORAGE_PROFILE_DEFAULT_ENDPOINT), not a plugin-code prefix:
 * - ENDPOINT (http://host:port or host)
 * - PORT (optional)
 * - USE_SSL (true/false)
 * - ACCESS_KEY
 * - SECRET_KEY
 * - BUCKET_NAME or BUCKET
 * - PREFIX (optional): root every object is stored under, e.g. `dev`
 *
 * Reads and deletes act only on refs in the profile's bucket and under its root.
 */
function createMinioAdapter(config: PluginConfigReader): StorageEngineAdapter {
  const endpointRaw = config.getRequired('ENDPOINT');
  let endPointHost: string;
  let port = Number(config.getOptional('PORT') ?? '9000');
  let useSSL = (config.getOptional('USE_SSL') ?? 'false') === 'true';

  try {
    const parsed = new URL(endpointRaw);
    endPointHost = parsed.hostname;
    if (parsed.port) port = Number(parsed.port);
    useSSL = parsed.protocol === 'https:';
  } catch {
    // Not a full URL, treat as host string
    endPointHost = endpointRaw;
  }

  const accessKey = config.getRequired('ACCESS_KEY');
  const secretKey = config.getRequired('SECRET_KEY');
  const bucket =
    config.getOptional('BUCKET') ??
    config.getOptional('BUCKET_NAME') ??
    config.getRequired('BUCKET_NAME');
  const root = config.getOptional('PREFIX');
  if (root !== undefined && !isStoragePrefix(root)) {
    throw new Error(`Invalid storage profile PREFIX '${root}'`);
  }

  const client = new Minio.Client({
    endPoint: endPointHost,
    port,
    useSSL,
    accessKey,
    secretKey,
  });

  function engineRefFor(key: string) {
    return `s3:${bucket}:${key}`;
  }

  function keyFor(engineFileRef: string): string | null {
    const key = ownedKey(engineFileRef, bucket, root);
    if (key === null) {
      log.warn({ plugin: CODE }, 'Stored ref is outside the profile bucket and root; ignored');
    }
    return key;
  }

  return {
    async readinessCheck() {
      try {
        const exists = await client.bucketExists(bucket);
        return { ok: exists };
      } catch (err: unknown) {
        return { ok: false, message: String(err) };
      }
    },

    async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
      const key = objectKey(root, input);
      if (input.buffer) {
        const stream = Readable.from(input.buffer);
        await client.putObject(bucket, key, stream, input.buffer.length, {
          'Content-Type': input.contentType || 'application/octet-stream',
        });
      } else if (input.stream) {
        await client.putObject(bucket, key, input.stream as Readable, input.size, {
          'Content-Type': input.contentType || 'application/octet-stream',
        });
      } else if (input.sourceUrl) {
        // Implementation could fetch the source URL and stream into putObject.
        throw new Error('sourceUrl uploads are not supported by storage-s3 adapter');
      } else {
        throw new Error('Only buffer/stream uploads supported');
      }
      return {
        engineFileRef: engineRefFor(key),
        publicUrl: undefined,
        metadata: { filename: input.filename },
      };
    },

    async getFile(engineFileRef: string): Promise<GetFileResult | null> {
      const key = keyFor(engineFileRef);
      if (key === null) return null;
      try {
        const stat = await client.statObject(bucket, key);
        const stream = await client.getObject(bucket, key);
        return {
          engineFileRef,
          filename: key.split('/').pop() ?? key,
          contentType: stat.metaData?.['content-type'] as string | undefined,
          size: stat.size,
          createdAt: stat.lastModified?.toISOString(),
          downloadStream: stream as unknown as NodeJS.ReadableStream,
        };
      } catch {
        return null;
      }
    },

    async deleteFile(engineFileRef: string): Promise<void> {
      const key = keyFor(engineFileRef);
      if (key === null) return;
      try {
        await client.removeObject(bucket, key);
      } catch {
        // ignore
      }
    },
  };
}

export const storagePluginDefinition: StoragePluginDefinition = {
  code: CODE,
  createAdapter: createMinioAdapter,
};
