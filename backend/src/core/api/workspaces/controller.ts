import { Response } from 'express';
import { z } from 'zod';
import { workspacesApiService } from './service';
import { asyncHandler } from '../shared/asyncHandler';
import { addStreamConnection } from './stream';
import { NotFoundError, ValidationError } from '../../errors';
import { getActorId, getActorIdpCode } from '../../middleware/actor';
import type { Request } from 'express';
import {
  ListWorkspacesQuerySchema,
  CreateWorkspaceBodySchema,
  UpdateWorkspaceBodySchema,
  WorkspaceIdParamsSchema,
} from './schema';

type ListWorkspacesQuery = z.infer<typeof ListWorkspacesQuerySchema>;
type CreateWorkspaceBody = z.infer<typeof CreateWorkspaceBodySchema>;
type UpdateWorkspaceBody = z.infer<typeof UpdateWorkspaceBodySchema>;
type WorkspaceIdParams = z.infer<typeof WorkspaceIdParamsSchema>;

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

export const streamWorkspaces = asyncHandler(async (req: Request, res: Response) => {
  const actorId = getActorId(req);
  if (!actorId) {
    throw new ValidationError('Missing actor identity');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  addStreamConnection(actorId, res);
  res.write('event: connected\ndata: {}\n\n');
});

export const createWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const actorId = getActorId(req);
  if (!actorId) {
    throw new ValidationError('Missing actor identity (actorId or x-soba-user-id)');
  }
  const result = await workspacesApiService.create(
    actorId,
    getActorIdpCode(req),
    req.body as CreateWorkspaceBody,
  );
  res.status(201).json(result);
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

export const updateWorkspace = asyncHandler(
  async (req: Request<WorkspaceIdParams, unknown, UpdateWorkspaceBody>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await workspacesApiService.update(ctx.workspaceId, ctx.actorId, req.body);
    if (!result) {
      throw new NotFoundError('Workspace not found');
    }
    res.json(result);
  },
);
