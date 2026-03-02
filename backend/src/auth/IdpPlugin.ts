/**
 * IdP (identity provider) plugin contract.
 * Lives outside core so core has no direct reference to plugin/IdP concepts.
 * Plugins implement this contract; auth layer discovers and wires them.
 */
import type { Request } from 'express';
import type { PluginConfigReader } from '../core/config/pluginConfig';
import type { NormalizedProfile, IdpAttributes } from '../core/auth/jwtClaims';

/** Result of mapping a validated token payload to the common user shape. */
export interface IdpMapPayloadResult {
  subject: string;
  providerCode: string;
  profile: NormalizedProfile;
  idpAttributes: IdpAttributes;
}

/** Per-request claim mapper: token payload → common user shape. Provided by each IdP plugin. */
export interface IdpClaimMapper {
  mapPayload(payload: Record<string, unknown>): IdpMapPayloadResult;
}

/** Definition discovered from a plugin directory; used to create middleware and mapper. */
export interface IdpPluginDefinition {
  readonly code: string;
  createAuthMiddleware(
    config: PluginConfigReader,
  ): (req: Request, res: unknown, next: (err?: unknown) => void) => void;
  createClaimMapper(config: PluginConfigReader): IdpClaimMapper;
}

/** Shared token extraction for use by plugins or composite auth. */
export function getToken(req: Request): string | null {
  try {
    if (!req || !req.headers) return null;

    const authHeader = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        return parts[1];
      }
    }

    const tokenHeader =
      (req.get && req.get('X-Jwt-Token')) ||
      (req.headers['x-jwt-token'] as string) ||
      (req.headers['X-Jwt-Token'] as string);
    if (tokenHeader && typeof tokenHeader === 'string') {
      return tokenHeader;
    }

    const q = req.query as Record<string, string | undefined>;
    if (q?.token && typeof q.token === 'string') return q.token;
    if (q?.['x-jwt-token'] && typeof q['x-jwt-token'] === 'string') return q['x-jwt-token'];

    return null;
  } catch {
    return null;
  }
}
