import passport from 'passport';
import { SOBA_PASSPORT_STRATEGY } from '../auth/passport';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { formVersions, submissions, userIdentities } from '../db/schema';
import { getWorkspaceForUser } from '../db/repos/membershipRepo';
import { listGroupsForIdp } from '../db/repos/idpGroupRepo';
import { resolveActor } from './actor';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Passport-backed JWT middleware that does not reject unauthenticated requests.
 * Allows public forms to be accessed without a token, while populating identity for others.
 */
export const checkJwtOptional = (): RequestHandler => {
  return (req, res, next) => {
    passport.authenticate(
      SOBA_PASSPORT_STRATEGY,
      { session: false },
      (err: unknown, user: Express.User | false | null) => {
        if (err) return next(err);
        if (user) {
          req.user = user;
        }
        next();
      },
    )(req, res, next);
  };
};

/**
 * Resolves req.actorId if a token is present, otherwise bypasses validation.
 */
export function resolveActorOptional(req: Request, res: Response, next: NextFunction): void {
  if (req.actorId || req.header('x-soba-user-id')) {
    return resolveActor(req, res, next);
  }

  const pluginCode = req.idpPluginCode;
  const payload = req.authPayload;

  if (!pluginCode || !payload || typeof payload !== 'object') {
    return next();
  }

  return resolveActor(req, res, next);
}

/**
 * Verifies if the request meets the form version's visibility settings.
 * If authorized, populates the request's coreContext to satisfy database audit constraints.
 */
export async function checkFormVisibility(req: Request, res: Response, next: NextFunction) {
  try {
    let formVersion = null;

    // 1. Identify which Form Version we are querying/submitting
    if (req.body && req.body.formVersionId) {
      // POST /submissions
      [formVersion] = await db
        .select()
        .from(formVersions)
        .where(and(eq(formVersions.id, req.body.formVersionId), isNull(formVersions.deletedAt)))
        .limit(1);
    } else if (req.params.id && req.path.includes('/submissions/')) {
      // POST /submissions/:id/save
      const [submission] = await db
        .select()
        .from(submissions)
        .where(and(eq(submissions.id, req.params.id), isNull(submissions.deletedAt)))
        .limit(1);
      if (submission) {
        [formVersion] = await db
          .select()
          .from(formVersions)
          .where(and(eq(formVersions.id, submission.formVersionId), isNull(formVersions.deletedAt)))
          .limit(1);
      }
    }

    if (!formVersion) {
      // Form version not found, let it proceed to standard 404 handlers downstream
      return next();
    }

    const allowedIdps = formVersion.visibility || [];
    const isPublic = allowedIdps.includes('public');

    // 2. Perform authorization checks
    if (!isPublic) {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required for this form',
        });
      }

      const userIdp = (req.user.providerCode || req.idpType || '').toLowerCase();
      let matched = false;

      if (allowedIdps.length > 0) {
        // Match a discrete provider-code token (e.g. 'azureidir') or any IDP group the user belongs to.
        const userGroups = await listGroupsForIdp(userIdp);
        matched = allowedIdps.some((token) => token === userIdp || userGroups.includes(token));
        if (!matched) {
          return res.status(403).json({
            error: 'Forbidden',
            message: `User identity provider '${userIdp}' is not authorized to access this form`,
          });
        }
      } else {
        // If visibility list is empty, default to workspace membership check
        const membership = req.actorId
          ? await getWorkspaceForUser(formVersion.workspaceId, req.actorId)
          : null;
        if (!membership) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'User does not belong to the workspace containing this form',
          });
        }
      }
    }

    // 3. Resolve the actorId and coreContext for downstream handlers
    let actorId = req.actorId;
    let actorDisplayLabel = null;

    if (req.user) {
      actorId = req.actorId;
      actorDisplayLabel = req.user.profile?.displayLabel || req.user.profile?.displayName || null;
    } else {
      // For unauthenticated/public submissions, resolve to the default seeded system user for DB constraints
      const systemIdentity = await db
        .select({ userId: userIdentities.userId })
        .from(userIdentities)
        .where(
          and(
            eq(userIdentities.identityProviderCode, 'system'),
            eq(userIdentities.subject, 'soba-system'),
          ),
        )
        .limit(1);

      if (systemIdentity[0]) {
        actorId = systemIdentity[0].userId;
        actorDisplayLabel = 'Public Submitter';
      }
    }

    req.coreContext = {
      workspaceId: formVersion.workspaceId,
      actorId: actorId || '00000000-0000-0000-0000-000000000000',
      actorDisplayLabel,
      workspaceSource: 'public-access',
    };

    next();
  } catch (error) {
    next(error);
  }
}
