import { Response } from 'express';
import { z } from 'zod';
import { workspacesApiService } from './service';
import { asyncHandler } from '../shared/asyncHandler';
import { NotFoundError } from '../../errors';
import type { Request } from 'express';
import { ListWorkspacesQuerySchema } from './schema';

type ListWorkspacesQuery = z.infer<typeof ListWorkspacesQuerySchema>;

export const listWorkspaces = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.coreContext!;
  const result = await workspacesApiService.list(
    ctx.actorId,
    req.query as unknown as ListWorkspacesQuery,
  );
  res.json(result);
});

export const getCurrentWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.coreContext!;
  const result = await workspacesApiService.getCurrent(ctx.workspaceId, ctx.actorId);
  if (!result) {
    throw new NotFoundError('Current workspace not found');
  }
  res.json(result);
});
