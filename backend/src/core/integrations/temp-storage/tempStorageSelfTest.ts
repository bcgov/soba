import type { Readable } from 'stream';
import type { TempStorageAdapter } from './TempStorageAdapter';

const PROBE = Buffer.from('soba-temp-storage-self-test');

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export interface TempStorageSelfTestResult {
  /** Where the probe was written (reveals the mount); null on failure. */
  path: string | null;
  /** Wrote a probe, read it back identical, and removed it. */
  roundTrip: boolean;
  message?: string;
}

/** Write a probe, read it back, verify, remove. Confirms write+read (ping only
 *  writes) and surfaces the path. Never throws; failure → roundTrip: false. */
export async function tempStorageSelfTest(
  adapter: TempStorageAdapter,
): Promise<TempStorageSelfTestResult> {
  try {
    const resource = await adapter.write(PROBE, { prefix: 'selftest' });
    try {
      const readBack = await readAll(adapter.createReadStream(resource));
      return { path: resource.path, roundTrip: readBack.equals(PROBE) };
    } finally {
      await adapter.remove(resource);
    }
  } catch (err) {
    return {
      path: null,
      roundTrip: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
