import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../errors';
import { isWorkspaceManageRole } from '../db/repos/membershipRepo';

/**
 * Gates a route on workspace-management authority (owner/admin). Runs after workspace resolution
 * (needs `req.coreContext`); responds 403 when the caller isn't an owner or admin.
 */
export const requireWorkspaceManage = (req: Request, _res: Response, next: NextFunction): void => {
  const context = req.coreContext;
  if (!context) {
    next(new Error('requireWorkspaceManage must run after workspace resolution'));
    return;
  }
  if (!isWorkspaceManageRole(context.role)) {
    next(new ForbiddenError('Workspace management requires an owner or admin role'));
    return;
  }
  next();
};
