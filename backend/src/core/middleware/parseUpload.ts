import type { Request, RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { AppError, PayloadTooLargeError, ValidationError } from '../errors';
import { log } from '../logging';

/** Minimal shape of a multer memory-storage file (this project has no @types/multer). */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** The file parseUpload read from the request. */
export function getUploadedFile(req: Request): UploadedFile {
  const uploaded = (req as Request & { files?: UploadedFile[] }).files?.[0];
  if (!uploaded) throw new ValidationError('no file');
  return uploaded;
}

function toUploadError(err: unknown): AppError {
  if (err instanceof MulterError) {
    // multer has no type declarations here, so instanceof doesn't narrow.
    const { code, message } = err as { code: string; message: string };
    return code === 'LIMIT_FILE_SIZE'
      ? new PayloadTooLargeError(message)
      : new ValidationError(message);
  }
  // Busboy's parse errors (missing boundary, truncated body) reach us as plain Errors.
  return new ValidationError('Malformed multipart body');
}

/** Parse a multipart upload of one file into memory, under any file field name. */
export const parseUpload = (maxFileBytes: number): RequestHandler => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileBytes, files: 1 },
    // Browsers send UTF-8 filenames; multer decodes them as latin1 unless told otherwise.
    defParamCharset: 'utf8',
  }).any();
  return (req, res, next) => {
    let settled = false;
    upload(req, res, (err?: unknown) => {
      // multer can call back again when the client drops after a header parse failure.
      if (settled) return;
      settled = true;
      if (!err) {
        next();
        return;
      }
      if (req.destroyed) {
        log.warn({ err }, 'Upload interrupted before the body was read');
      }
      next(toUploadError(err));
    });
  };
};
