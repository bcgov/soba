import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors';
import { log } from '../logging';

export interface ErrorHttpResponse {
  statusCode: number;
  body: { error: string };
}

export function errorToHttpResponse(err: unknown): ErrorHttpResponse {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, body: { error: err.message } };
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
