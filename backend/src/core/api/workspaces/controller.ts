import { Response } from 'express';
import { z } from 'zod';
import { workspacesApiService } from './service';
import { asyncHandler } from '../shared/asyncHandler';
import { NotFoundError, ValidationError } from '../../errors';
import { getActorId } from '../../middleware/actor';
import type { Request } from 'express';
import { ListWorkspacesQuerySchema } from './schema';

type ListWorkspacesQuery = z.infer<typeof ListWorkspacesQuerySchema>;

export const listWorkspaces = asyncHandler(async (req: Request, res: Response) => {
  const actorId = getActorId(req);
  if (!actorId) {
    throw new ValidationError('Missing actor identity (actorId or x-soba-user-id)');
  }
  const result = await workspacesApiService.list(
    actorId,
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

export const getWorkspaceById = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.coreContext!;
  const result = await workspacesApiService.getCurrent(ctx.workspaceId, ctx.actorId);
  if (!result) {
    throw new NotFoundError('Workspace not found');
  }
  res.json(result);
});
