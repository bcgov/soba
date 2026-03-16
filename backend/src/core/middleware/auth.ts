import type { RequestHandler } from 'express';
import passport from 'passport';
import { SOBA_PASSPORT_STRATEGY } from '../auth/passport';

const unauthorizedResponse = {
  error: 'Unauthorized',
  message: 'Error occurred during authentication',
  statusCode: 401,
};

/** Passport-backed composite IdP auth middleware. */
export const checkJwt = (): RequestHandler => {
  return (req, res, next) => {
    passport.authenticate(
      SOBA_PASSPORT_STRATEGY,
      { session: false },
      (err: unknown, user: Express.User | false | null, info?: { error?: unknown }) => {
        if (err) return next(err);
        if (!user) {
          if (info?.error) return next(info.error);
          return res.status(401).json(unauthorizedResponse);
        }
        req.user = user;
        next();
      },
    )(req, res, next);
  };
};
