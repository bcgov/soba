import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { log } from '../../core/logging';

/**
 * Stream a stored file to the response. Any failure closes the response, so it is logged here: a
 * client disconnect at info, a storage failure at error.
 */
export async function streamFile(
  source: NodeJS.ReadableStream,
  res: Response,
  fileId: string,
): Promise<void> {
  try {
    await pipeline(source, res);
  } catch (err) {
    if ((err as { code?: unknown }).code === 'ERR_STREAM_PREMATURE_CLOSE') {
      log.info({ fileId }, 'File download closed by the client');
      return;
    }
    log.error({ err, fileId }, 'File download failed');
  }
}
