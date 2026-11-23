import { createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { finished, pipeline } from 'node:stream/promises';
import { ZipFile } from 'yazl';

/** Every entry is stored as it is, without compression. */
const STORED = { compress: false } as const;

/** A zip written to a file one entry at a time. */
export interface ZipWriter {
  addBuffer(data: Buffer, name: string): void;
  /** Adds `size` bytes from `stream`, and resolves once the zip has read them all. */
  addStream(stream: Readable, name: string, size: number): Promise<void>;
  /** Ends the zip and resolves with its size on disk. */
  finish(): Promise<number>;
  /** Stops writing and resolves once the file is closed. Call it when `finish` did not succeed. */
  abandon(): Promise<void>;
}

/**
 * A zip written to `path`. A stream whose byte count is not its `size`, a failed read or write, or
 * an abort rejects the entry being added or the finish.
 */
export const openZip = (path: string, signal: AbortSignal): ZipWriter => {
  const zip = new ZipFile();
  const stop = new AbortController();
  const failed = new Promise<never>((_resolve, reject) => zip.on('error', reject));
  const piped = pipeline(zip.outputStream, createWriteStream(path), {
    signal: AbortSignal.any([signal, stop.signal]),
  });
  const written = Promise.race([piped, failed]);
  // Read by addStream, finish or abandon; this keeps a failure before then from going unhandled.
  written.catch(() => undefined);
  return {
    addBuffer: (data, name) => zip.addBuffer(data, name, STORED),
    addStream: async (stream, name, size) => {
      zip.addReadStreamLazy(name, { ...STORED, size }, (callback) => callback(null, stream));
      await Promise.race([finished(stream), written]);
    },
    finish: async () => {
      zip.end();
      await written;
      return (await stat(path)).size;
    },
    abandon: async () => {
      stop.abort();
      await piped.catch(() => undefined);
    },
  };
};
