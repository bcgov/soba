/**
 * Resolves req.actorId from JWT (via IdP plugins) when not already set.
 * Refreshes soba_admin from IdP when the mapper returns sobaAdmin, then sets req.isSobaAdmin.
 * Must run after checkJwt() so that req.idpPluginCode and req.authPayload are set.
 */
import { Request, Response, NextFunction } from 'express';
const X_SOBA_USER_ID = 'x-soba-user-id';
import { getIdpPlugins } from '../auth/idpRegistry';
import { findOrCreateUserByIdentity } from '../db/repos/membershipRepo';
import { isSobaAdmin, upsertSobaAdminFromIdp } from '../db/repos/sobaAdminRepo';
import { ValidationError } from '../errors';
import { profileHelpers } from '../auth/jwtClaims';
import { getPublicUser } from '../services/publicUser';
import { PUBLIC_PROVIDER_CODE } from '../db/codes';

/**
 * Read the resolved actor id, falling back to the dev/test `x-soba-user-id` bypass header.
 * Used by actor-only routes that don't resolve a workspace context.
 */
export const getActorId = (req: Request): string | null =>
  req.actorId ?? req.header(X_SOBA_USER_ID) ?? null;

/** Identity provider code for the current session (from the verified JWT). */
export const getActorIdpCode = (req: Request): string | null =>
  req.user?.providerCode?.toLowerCase() ?? null;

export function resolveActor(req: Request, res: Response, next: NextFunction): void {
  const actorId = getActorId(req);
  if (actorId) {
    isSobaAdmin(actorId)
      .then((admin) => {
        req.isSobaAdmin = admin;
        next();
      })
      .catch(next);
    return;
  }

  const pluginCode = (req as Request & { idpPluginCode?: string }).idpPluginCode;
  const payload = (req as Request & { authPayload?: Record<string, unknown> }).authPayload;

  if (!pluginCode || !payload || typeof payload !== 'object') {
    return next(new ValidationError('Missing IdP plugin context (idpPluginCode) or token payload'));
  }

  const plugins = getIdpPlugins();
  const plugin = plugins.find((p) => p.code === pluginCode);
  if (!plugin) {
    return next(new ValidationError(`Unknown IdP plugin: ${pluginCode}`));
  }

  const mapped = plugin.claimMapper.mapPayload(payload);
  const actorDisplayLabel =
    mapped.profile?.displayLabel ??
    profileHelpers.getDisplayLabel(mapped.profile, mapped.subject) ??
    null;

  findOrCreateUserByIdentity(
    mapped.providerCode,
    mapped.subject,
    mapped.profile,
    mapped.idpAttributes,
  )
    .then((actorId) => {
      req.actorId = actorId;

      const refresh =
        typeof mapped.sobaAdmin === 'boolean'
          ? upsertSobaAdminFromIdp(actorId, pluginCode, mapped.sobaAdmin, actorDisplayLabel)
          : Promise.resolve();

      return refresh.then(() => isSobaAdmin(actorId));
    })
    .then((admin) => {
      req.isSobaAdmin = admin;
      next();
    })
    .catch(next);
}

/**
 * Actor resolver for routes mounted with `checkJwt({ allowPublic: true })`: resolves the authenticated
 * actor when a token/identity is present, otherwise attributes the request to the seeded public user
 * (idp `public`). The route's own authorization (e.g. the Form submitters audience) decides access;
 * the public user is a member of no workspace, so staff-only routes still reject it.
 */
export function resolveActorOrPublic(req: Request, res: Response, next: NextFunction): void {
  const hasIdentity =
    req.actorId || req.header(X_SOBA_USER_ID) || (req.idpPluginCode && req.authPayload);
  if (hasIdentity) {
    return resolveActor(req, res, next);
  }

  getPublicUser()
    .then((publicUser) => {
      if (!publicUser) {
        return next(new Error('Public user is not seeded; run the seed step'));
      }
      req.actorId = publicUser.id;
      req.idpType = PUBLIC_PROVIDER_CODE;
      req.isSobaAdmin = false;
      next();
    })
    .catch(next);
}
