import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors';
import { log } from '../logging';

export interface ErrorHttpResponse {
  statusCode: number;
  body: { error: string };
}

const PG_UNIQUE_VIOLATION = '23505';

// Drizzle wraps the driver error, so the pg code can sit on the cause chain, not the top level.
function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e != null && depth < 5; depth++) {
    if ((e as { code?: unknown }).code === PG_UNIQUE_VIOLATION) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

export function errorToHttpResponse(err: unknown): ErrorHttpResponse {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, body: { error: err.message } };
  }
  // A unique-index violation is a conflict (e.g. a name-uniqueness race), not a server error.
  if (isUniqueViolation(err)) {
    return { statusCode: 409, body: { error: 'Resource already exists' } };
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  return { statusCode: 500, body: { error: message } };
}

export const coreErrorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // Express error middleware requires 4 args; next is intentionally unused
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  const { statusCode, body } = errorToHttpResponse(err);
  if (statusCode === 500) {
    log.error({ err }, 'Unhandled error');
  }
  res.status(statusCode).json(body);
};
