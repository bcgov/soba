import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors';
import { log } from '../logging';

export const coreErrorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // Express error middleware requires 4 args; next is intentionally unused
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: message });
};
