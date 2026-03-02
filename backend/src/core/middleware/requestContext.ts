import { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getWorkspaceForUser } from '../db/repos/membershipRepo';
import { getWorkspaceResolvers, getCacheAdapter } from '../integrations/plugins/PluginRegistry';
import { membershipKey } from '../integrations/cache/cacheKeys';
import { ForbiddenError, ValidationError } from '../errors';
import { db } from '../db/client';
import { appUsers } from '../db/schema';

export interface CoreRequestContext {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  workspaceSource: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    coreContext?: CoreRequestContext;
    /** Resolved app_user id; set by auth/actor middleware before core context. */
    actorId?: string;
  }
}

// Request context resolution policy:
// 1) Actor must be resolved before this middleware (via x-soba-user-id or auth middleware setting req.actorId).
// 2) Workspace resolution: run configured resolver plugins in priority order; first match wins.
export const resolveCoreContext = async (req: Request): Promise<CoreRequestContext> => {
  const actorId = req.actorId ?? req.header('x-soba-user-id') ?? null;
  if (!actorId) {
    throw new ValidationError('Missing actor identity (actorId or x-soba-user-id)');
  }

  const resolvers = getWorkspaceResolvers();
  for (const resolver of resolvers) {
    const resolved = await resolver.resolve({ req, actorId });
    if (resolved) {
      const cache = getCacheAdapter();
      const cacheKey = membershipKey(resolved.workspaceId, actorId);
      const getOrSet = cache.getOrSet?.bind(cache);
      const membership = getOrSet
        ? await getOrSet(cacheKey, () => getWorkspaceForUser(resolved.workspaceId, actorId))
        : await getWorkspaceForUser(resolved.workspaceId, actorId);
      if (!membership) {
        throw new ForbiddenError('Actor does not belong to workspace');
      }
      const userRow = await db
        .select({ displayLabel: appUsers.displayLabel })
        .from(appUsers)
        .where(eq(appUsers.id, actorId))
        .limit(1);
      const actorDisplayLabel = userRow[0]?.displayLabel ?? null;
      return {
        workspaceId: resolved.workspaceId,
        actorId,
        actorDisplayLabel,
        workspaceSource: resolved.source,
      };
    }
  }

  throw new ForbiddenError('Unable to resolve workspace from request context');
};

export const coreContextMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.coreContext = await resolveCoreContext(req);
    next();
  } catch (error) {
    next(error);
  }
};

export const resolveCoreContextForWorkspace = async (
  req: Request,
  workspaceId: string,
  context?: CoreRequestContext,
): Promise<CoreRequestContext> => {
  const ctx = context ?? req.coreContext;
  if (ctx) {
    if (ctx.workspaceId !== workspaceId) {
      throw new ForbiddenError('Resolved workspace does not match requested workspace');
    }
    return {
      workspaceId,
      actorId: ctx.actorId,
      actorDisplayLabel: ctx.actorDisplayLabel,
      workspaceSource: ctx.workspaceSource,
    };
  }
  const resolved = await resolveCoreContext(req);
  if (resolved.workspaceId !== workspaceId) {
    throw new ForbiddenError('Resolved workspace does not match requested workspace');
  }
  return {
    workspaceId,
    actorId: resolved.actorId,
    actorDisplayLabel: resolved.actorDisplayLabel,
    workspaceSource: resolved.workspaceSource,
  };
};
