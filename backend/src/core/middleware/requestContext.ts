import { NextFunction, Request, Response } from 'express';
import { findOrCreateUserByIdentity } from '../db/repos/membershipRepo';
import { getWorkspaceResolvers } from '../integrations/workspace/WorkspaceResolverRegistry';

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
      throw new Error('Missing subject from token');
    }

    const provider =
      (typeof req.idpType === 'string' ? req.idpType : '') ||
      (typeof decoded?.idpType === 'string' ? decoded.idpType : '') ||
      'idir';

    actorId = await findOrCreateUserByIdentity(provider, subject, {
      displayName: typeof decoded?.display_name === 'string' ? decoded.display_name : undefined,
      email: typeof decoded?.email === 'string' ? decoded.email : undefined,
    });
  }

  const resolvers = getWorkspaceResolvers();
  for (const resolver of resolvers) {
    const resolved = await resolver.resolve({ req, actorId });
    if (resolved) {
      return {
        workspaceId: resolved.workspaceId,
        actorId,
        workspaceSource: resolved.source,
      };
    }
  }

  throw new Error('Unable to resolve workspace from request context');
};

export const coreContextMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.coreContext = await resolveCoreContext(req);
    next();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const resolveCoreContextForWorkspace = async (
  req: Request,
  workspaceId: string,
): Promise<CoreRequestContext> => {
  const context = await resolveCoreContext(req);
  if (context.workspaceId !== workspaceId) {
    throw new Error('Resolved workspace does not match requested workspace');
  }
  return {
    workspaceId,
    actorId: context.actorId,
    workspaceSource: context.workspaceSource,
  };
};
