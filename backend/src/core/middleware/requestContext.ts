import { NextFunction, Request, Response } from 'express';
import { findOrCreateUserByIdentity, getWorkspaceForUser } from '../db/repos/membershipRepo';
import { getWorkspaceResolvers, getCacheAdapter } from '../integrations/plugins/PluginRegistry';
import { membershipKey } from '../integrations/cache/cacheKeys';
import { ForbiddenError, ValidationError } from '../errors';
import { normalizeProfileFromJwt, idpAttributesFromJwt } from '../auth/jwtClaims';

export interface CoreRequestContext {
  workspaceId: string;
  actorId: string;
  workspaceSource: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    coreContext?: CoreRequestContext;
  }
}

// Request context resolution policy:
// 1) Actor resolution:
//    - Prefer x-soba-user-id when present (trusted internal/gateway path).
//    - Otherwise resolve from token identity (idpType + sub), creating user on first sight.
// 2) Workspace resolution:
//    - Run configured resolver plugins in priority order; first match wins.
//    - Enterprise plugins typically map external tenant/workspace headers to a workspace.
//    - Personal plugin typically uses selected workspace (cookie/header) then falls back to home.
// 3) Failure behavior:
//    - Missing actor identity or no resolver match throws and request is rejected upstream.
export const resolveCoreContext = async (req: Request): Promise<CoreRequestContext> => {
  const actorFromHeader = req.header('x-soba-user-id') || null;
  const decoded = req.decodedJwt;
  let actorId = actorFromHeader;
  if (!actorId) {
    const subject = typeof decoded?.sub === 'string' ? decoded.sub : '';
    if (!subject) {
      throw new ValidationError('Missing subject from token');
    }

    const provider =
      (typeof req.idpType === 'string' ? req.idpType : '') ||
      (typeof decoded?.identity_provider === 'string' ? decoded.identity_provider : '') ||
      (typeof decoded?.idpType === 'string' ? decoded.idpType : '') ||
      'idir';

    const profile =
      decoded && typeof decoded === 'object' ? normalizeProfileFromJwt(decoded) : undefined;
    const idpAttributes =
      decoded && typeof decoded === 'object' ? idpAttributesFromJwt(decoded) : undefined;

    actorId = await findOrCreateUserByIdentity(provider, subject, profile, idpAttributes);
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
      return {
        workspaceId: resolved.workspaceId,
        actorId,
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
    return { workspaceId, actorId: ctx.actorId, workspaceSource: ctx.workspaceSource };
  }
  const resolved = await resolveCoreContext(req);
  if (resolved.workspaceId !== workspaceId) {
    throw new ForbiddenError('Resolved workspace does not match requested workspace');
  }
  return {
    workspaceId,
    actorId: resolved.actorId,
    workspaceSource: resolved.workspaceSource,
  };
};
