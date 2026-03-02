import { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../errors';

/**
 * Guard middleware: ensures req.coreContext is set (coreContextMiddleware must run first).
 * Use after coreContextMiddleware so that core route handlers can assume coreContext is defined.
 */
export const requireCoreContext = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.coreContext) {
    next(new ForbiddenError('Request context is required'));
    return;
  }
  next();
};
