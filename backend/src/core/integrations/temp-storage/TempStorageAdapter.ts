/**
 * Pluggable temp storage for staging transient bytes (e.g. an upload awaiting a
 * virus scan). Implementations are provided by plugins (tempstorage-os for local
 * dev / PRs, tempstorage-mount for other deployments) and selected via
 * TEMPSTORAGE_DEFAULT_CODE. Both are disk-backed; the difference is the base
 * directory (os.tmpdir() vs a shared mount).
 *
 * The API is stream-centric so consumers don't have to touch the filesystem, but
 * every resource also carries a real `path` for external tools (e.g. clamd's
 * file scan).
 */
import type { Readable } from 'stream';
import type { PluginConfigReader } from '../../config/pluginConfig';

/** A staged transient resource, backed by a real filesystem path. */
export interface TempResource {
  id: string;
  path: string;
}

export interface TempWriteOptions {
  /** Filename prefix for disk-backed adapters; ignored by in-memory. */
  prefix?: string;
}

export interface TempStorageAdapter {
  /** Stage bytes (Buffer or stream) and return a handle. */
  write(data: Buffer | Readable, opts?: TempWriteOptions): Promise<TempResource>;
  /** Open a readable stream over a previously staged resource. */
  createReadStream(resource: TempResource): Readable;
  /** Remove a staged resource. No-op if it is already gone. */
  remove(resource: TempResource): Promise<void>;
  /** Health check: round-trip a tiny file (write then remove). Used by readiness. */
  ping(): Promise<boolean>;
}

export interface TempStoragePluginDefinition {
  code: string;
  createAdapter: (config: PluginConfigReader) => TempStorageAdapter;
}

/** Stage `data`, run `fn` with the handle, then remove it even if `fn` throws. */
export async function withTempResource<T>(
  adapter: TempStorageAdapter,
  data: Buffer | Readable,
  fn: (resource: TempResource) => Promise<T>,
  opts?: TempWriteOptions,
): Promise<T> {
  const resource = await adapter.write(data, opts);
  try {
    return await fn(resource);
  } finally {
    await adapter.remove(resource);
  }
}
