import type { RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { AppError, PayloadTooLargeError, ValidationError } from '../../core/errors';
import { log } from '../../core/logging';

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

/**
 * Parse a multipart upload of one file into memory. Accepts any file field name (Form.io's fileKey
 * is configurable; the component uploads one at a time).
 */
export const parseUpload = (maxFileBytes: number): RequestHandler => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileBytes, files: 1 },
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
