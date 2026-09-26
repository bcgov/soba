import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import type { FileRecord } from '../../db/repos/fileRepo';
import type { GetFileResult } from '../../integrations/storage-engine/StorageEngineAdapter';
import { InternalError } from '../../errors';
import { log } from '../../logging';

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

/** Send a stored file as the response body, or redirect to the backend's public URL for it. */
export async function sendStoredFile(
  res: Response,
  record: FileRecord,
  file: GetFileResult,
  disposition: 'inline' | 'attachment',
): Promise<void> {
  if (file.downloadStream) {
    res.setHeader(
      'Content-Type',
      record.contentType ?? file.contentType ?? 'application/octet-stream',
    );
    // The stored bytes set the length; a stale record size would misframe the response.
    const size = file.size ?? record.size;
    if (size != null) res.setHeader('Content-Length', String(size));
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(record.filename)}"`,
    );
    await streamFile(file.downloadStream, res, record.id);
    return;
  }
  if (file.publicUrl) {
    res.redirect(file.publicUrl);
    return;
  }
  throw new InternalError('no download available');
}
