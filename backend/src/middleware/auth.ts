import { Request, Response, NextFunction } from 'express';
import { createIdpAuthMiddleware } from '../auth/idpRegistry';

declare module 'express-serve-static-core' {
  interface Request {
    decodedJwt?: Record<string, unknown>;
    /** Validated token payload; set by IdP plugin middleware. Same as decodedJwt for compatibility. */
    authPayload?: Record<string, unknown>;
    bceidType?: 'bceidbasic' | 'bceidbusiness';
    /** Identity provider code from token (e.g. idir, azureidir, bceidbasic, bceidbusiness). */
    idpType?: string;
    /** Code of the IdP plugin that validated the token (e.g. bcgov-sso). */
    idpPluginCode?: string;
  }
}

export const ROLE_FIELD = process.env.ROLE_FIELD || 'Role';

/** Composite IdP auth middleware: tries each configured IdP plugin in order; first success wins. Use this for protected routes. */
export const checkJwt = () => createIdpAuthMiddleware();

export const extractOidcSub = (req: Request, res: Response, next: NextFunction) => {
  if (req.decodedJwt) {
    console.log('Authenticated request', {
      sub: req.decodedJwt.sub,
      //   token: req.headers.authorization?.split(' ')[1]?.substring(0, 20) + '...',
      decodedJwt: req.decodedJwt,
    });
    next();
  } else {
    console.error('No decodedJwt found in request');
    res.status(401).json({ error: 'Error ocurred during authentication' });
  }
};

export const jwtErrorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  const error = err as {
    name?: string;
    message?: string;
    code?: string;
    inner?: { message?: string };
  };
  if (error.name === 'UnauthorizedError') {
    console.error('JWT Validation Error (fallback):', {
      error: error.message,
      code: error.code,
      inner: error.inner?.message,
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Error occurred during authentication',
      statusCode: 401,
    });
  }
  next(err);
};

export const hasRole = (user: Record<string, unknown> | undefined, role: string): boolean => {
  if (!user || typeof user !== 'object') return false;
  const roles = user[ROLE_FIELD];
  if (typeof roles === 'string') return roles.includes(role);
  if (Array.isArray(roles)) return roles.includes(role);
  return false;
};
