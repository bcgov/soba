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
 */
function parseEngineRef(ref: string) {
  if (!ref.startsWith('s3:')) return null;
  const parts = ref.split(':');
  return { bucket: parts[1], key: parts.slice(2).join(':') };
}

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
      const key = `${input.workspaceId ?? 'default'}/${Date.now()}-${input.workspaceId}-${input.filename}`;
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
      const parsed = parseEngineRef(engineFileRef);
      if (!parsed) return null;
      try {
        const stat = await client.statObject(parsed.bucket, parsed.key);
        const stream = await client.getObject(parsed.bucket, parsed.key);
        return {
          engineFileRef,
          filename: parsed.key.split('/').pop() ?? parsed.key,
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
      const parsed = parseEngineRef(engineFileRef);
      if (!parsed) return;
      try {
        await client.removeObject(parsed.bucket, parsed.key);
      } catch {
        // ignore
      }
    },
  };
}

export const storagePluginDefinition: StoragePluginDefinition = {
  code: 'storage-s3',
  createAdapter: createMinioAdapter,
};
