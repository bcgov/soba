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

type FormVersionRow = typeof formVersions.$inferSelect;
type VisibilityDenial = { status: number; body: { error: string; message: string } };

/** Identify the target form version: from the submission body (POST /submissions) or, for
 *  POST /submissions/:id/save, via the referenced submission. Null when none can be resolved. */
async function loadTargetFormVersion(req: Request): Promise<FormVersionRow | null> {
  if (req.body && req.body.formVersionId) {
    const [formVersion] = await db
      .select()
      .from(formVersions)
      .where(and(eq(formVersions.id, req.body.formVersionId), isNull(formVersions.deletedAt)))
      .limit(1);
    return formVersion ?? null;
  }

  if (req.params.id && req.path.includes('/submissions/')) {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(and(eq(submissions.id, req.params.id), isNull(submissions.deletedAt)))
      .limit(1);
    if (!submission) return null;
    const [formVersion] = await db
      .select()
      .from(formVersions)
      .where(and(eq(formVersions.id, submission.formVersionId), isNull(formVersions.deletedAt)))
      .limit(1);
    return formVersion ?? null;
  }

  return null;
}

/** Authorize the request against the form version's visibility. Returns a denial to send, or null
 *  when access is granted (including public forms). */
async function authorizeFormVisibility(
  req: Request,
  formVersion: FormVersionRow,
): Promise<VisibilityDenial | null> {
  const allowedIdps = formVersion.visibility || [];
  if (allowedIdps.includes('public')) return null;

  if (!req.user) {
    return {
      status: 401,
      body: { error: 'Unauthorized', message: 'Authentication required for this form' },
    };
  }

  if (allowedIdps.length > 0) {
    // Match a discrete provider-code token (e.g. 'azureidir') or any IDP group the user belongs to.
    const userIdp = (req.user.providerCode || req.idpType || '').toLowerCase();
    const userGroups = await listGroupsForIdp(userIdp);
    const matched = allowedIdps.some((token) => token === userIdp || userGroups.includes(token));
    if (!matched) {
      return {
        status: 403,
        body: {
          error: 'Forbidden',
          message: `User identity provider '${userIdp}' is not authorized to access this form`,
        },
      };
    }
    return null;
  }

  // Empty visibility list: default to a workspace membership check.
  const membership = req.actorId
    ? await getWorkspaceForUser(formVersion.workspaceId, req.actorId)
    : null;
  if (!membership) {
    return {
      status: 403,
      body: {
        error: 'Forbidden',
        message: 'User does not belong to the workspace containing this form',
      },
    };
  }
  return null;
}

/** Resolve the actor identity for downstream audit constraints: the authenticated user, or the
 *  seeded system user for unauthenticated/public submissions. */
async function resolveVisibilityActor(
  req: Request,
): Promise<{ actorId: string | undefined; actorDisplayLabel: string | null }> {
  if (req.user) {
    return {
      actorId: req.actorId,
      actorDisplayLabel: req.user.profile?.displayLabel || req.user.profile?.displayName || null,
    };
  }

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
    return { actorId: systemIdentity[0].userId, actorDisplayLabel: 'Public Submitter' };
  }

  return { actorId: req.actorId, actorDisplayLabel: null };
}

/**
 * Verifies if the request meets the form version's visibility settings.
 * If authorized, populates the request's coreContext to satisfy database audit constraints.
 */
export async function checkFormVisibility(req: Request, res: Response, next: NextFunction) {
  try {
    const formVersion = await loadTargetFormVersion(req);
    if (!formVersion) {
      // Form version not found, let it proceed to standard 404 handlers downstream
      return next();
    }

    const denial = await authorizeFormVisibility(req, formVersion);
    if (denial) {
      return res.status(denial.status).json(denial.body);
    }

    const { actorId, actorDisplayLabel } = await resolveVisibilityActor(req);

    req.coreContext = {
      workspaceId: formVersion.workspaceId,
      actorId: actorId || '00000000-0000-0000-0000-000000000000',
      actorDisplayLabel,
      workspaceSource: 'public-access',
    };

    // Echo the resolved workspace so the frontend's per-tab store can capture it (same contract
    // as the authenticated workspace middleware).
    res.set('x-soba-workspace-id', formVersion.workspaceId);

    next();
  } catch (error) {
    next(error);
  }
}
