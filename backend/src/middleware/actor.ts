/**
 * Resolves req.actorId from JWT (via IdP plugins) when not already set.
 * Must run after checkJwt() so that req.idpPluginCode and req.authPayload are set.
 * Core requestContext then only reads req.actorId and does workspace resolution.
 */
import { Request, Response, NextFunction } from 'express';
import { getIdpPlugins } from '../auth/idpRegistry';
import { findOrCreateUserByIdentity } from '../core/db/repos/membershipRepo';
import { ValidationError } from '../core/errors';

export function resolveActor(req: Request, res: Response, next: NextFunction): void {
  if (req.actorId || req.header('x-soba-user-id')) {
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
  findOrCreateUserByIdentity(
    mapped.providerCode,
    mapped.subject,
    mapped.profile,
    mapped.idpAttributes,
  )
    .then((actorId) => {
      (req as Request & { actorId?: string }).actorId = actorId;
      next();
    })
    .catch(next);
}
