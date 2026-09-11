import type { RequestHandler } from 'express';
import passport from 'passport';
import { SOBA_PASSPORT_STRATEGY } from '../auth/passport';

const unauthorizedResponse = {
  error: 'Unauthorized',
  message: 'Error occurred during authentication',
  statusCode: 401,
};

/**
 * Passport-backed IdP auth middleware. `allowPublic` lets an absent/invalid token through
 * unauthenticated (req.user stays unset) for the public submit surface; otherwise rejects with 401.
 */
export const checkJwt = (opts: { allowPublic?: boolean } = {}): RequestHandler => {
  return (req, res, next) => {
    passport.authenticate(
      SOBA_PASSPORT_STRATEGY,
      { session: false },
      (err: unknown, user: Express.User | false | null, info?: { error?: unknown }) => {
        if (err) return next(err);
        if (!user) {
          if (opts.allowPublic) return next();
          if (info?.error) return next(info.error);
          return res.status(401).json(unauthorizedResponse);
        }
        req.user = user;
        next();
      },
    )(req, res, next);
  };
};
