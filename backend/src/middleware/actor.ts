/**
 * Resolves req.actorId from JWT (via IdP plugins) when not already set.
 * Refreshes soba_admin from IdP when the mapper returns sobaAdmin, then sets req.isSobaAdmin.
 * Must run after checkJwt() so that req.idpPluginCode and req.authPayload are set.
 */
import { Request, Response, NextFunction } from 'express';
import { getIdpPlugins } from '../auth/idpRegistry';
import { findOrCreateUserByIdentity } from '../core/db/repos/membershipRepo';
import { isSobaAdmin, upsertSobaAdminFromIdp } from '../core/db/repos/sobaAdminRepo';
import { ValidationError } from '../core/errors';
import { profileHelpers } from '../core/auth/jwtClaims';

export function resolveActor(req: Request, res: Response, next: NextFunction): void {
  if (req.actorId || req.header('x-soba-user-id')) {
    // Actor already set (e.g. x-soba-user-id); still resolve isSobaAdmin from table
    const actorId = req.actorId ?? req.header('x-soba-user-id') ?? null;
    if (actorId) {
      isSobaAdmin(actorId)
        .then((admin) => {
          req.isSobaAdmin = admin;
          next();
        })
        .catch(next);
      return;
    }
    return next();
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

      // Refresh soba_admin from IdP when mapper signals it
      const refresh =
        mapped.sobaAdmin === true
          ? upsertSobaAdminFromIdp(actorId, pluginCode, true, actorDisplayLabel)
          : mapped.sobaAdmin === false
            ? upsertSobaAdminFromIdp(actorId, pluginCode, false, actorDisplayLabel)
            : Promise.resolve();

      return refresh.then(() => isSobaAdmin(actorId));
    })
    .then((admin) => {
      req.isSobaAdmin = admin;
      next();
    })
    .catch(next);
}
