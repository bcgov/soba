import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError, NotFoundError } from '../errors';
import { log } from '../logging';

export interface ErrorHttpResponse {
  statusCode: number;
  body: { error: string };
}

const PG_UNIQUE_VIOLATION = '23505';
// Text the column type can't hold: invalid text representation (a non-uuid id), and a character the
// database encoding rejects (a NUL in text).
const PG_INVALID_INPUT = ['22P02', '22021', '22P05'];
const INTERNAL_ERROR = 'Internal server error';

// Drizzle wraps the driver error, so the pg code can sit on the cause chain, not the top level.
function hasPgCode(err: unknown, codes: readonly string[]): boolean {
  for (let e: unknown = err, depth = 0; e != null && depth < 5; depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && codes.includes(code)) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * The 4xx status of a request rejected before app code runs: http-errors (body-parser) marks it
 * `expose`, express-jwt raises UnauthorizedError, and Express flags an undecodable path param with a
 * URIError. Form.io and outbound HTTP errors also carry a status, but it is the upstream's; left
 * unmapped, they are 500s.
 */
function clientErrorStatus(err: unknown): number | null {
  if (!(err instanceof Error)) return null;
  const { status, expose } = err as Error & { status?: unknown; expose?: unknown };
  if (typeof status !== 'number' || status < 400 || status >= 500) return null;
  const trusted = expose === true || err.name === 'UnauthorizedError' || err instanceof URIError;
  return trusted ? status : null;
}

export function errorToHttpResponse(err: unknown): ErrorHttpResponse {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, body: { error: err.message } };
  }
  // A unique-index violation is a conflict (e.g. a name-uniqueness race), not a server error.
  if (hasPgCode(err, [PG_UNIQUE_VIOLATION])) {
    return { statusCode: 409, body: { error: 'Resource already exists' } };
  }
  if (hasPgCode(err, PG_INVALID_INPUT)) {
    return { statusCode: 400, body: { error: 'Invalid input' } };
  }
  const clientStatus = clientErrorStatus(err);
  if (clientStatus !== null) {
    return { statusCode: clientStatus, body: { error: (err as Error).message } };
  }
  // Unexpected errors can carry SQL or hostnames, so their detail goes to the log only.
  return { statusCode: 500, body: { error: INTERNAL_ERROR } };
}

export const coreErrorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // A response already streaming can't be replaced; Express's default handler closes the socket.
  if (res.headersSent) {
    next(err);
    return;
  }
  const { statusCode, body } = errorToHttpResponse(err);
  if (statusCode === 500) {
    log.error({ err }, 'Unhandled error');
  } else if (hasPgCode(err, PG_INVALID_INPUT)) {
    // A server-side value can cause this too, and a 400 alone leaves no trace.
    log.warn({ err }, 'Database rejected request input');
  }
  res.status(statusCode).json(body);
};

/** A request no route matched is a 404 here; it never reaches a later mount. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('Not found'));
};
