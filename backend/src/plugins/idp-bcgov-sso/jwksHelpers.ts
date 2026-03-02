/**
 * JWKS/OIDC helpers for BC Gov SSO (RS256, JWKS URI).
 * Extracted from shared idp-base; used only by this plugin.
 */

import type { RequestHandler } from 'express';
import { expressjwt as jwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { getToken } from '../../auth/IdpPlugin';

export function firstString(
  claims: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const v = claims[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

/** Only treat as email if it contains @ (preferred_username can be idir_username). */
export function firstEmailLike(
  claims: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  const s = firstString(claims, keys);
  return s && s.includes('@') ? s : null;
}

const DEFAULT_OMIT_CLAIMS = new Set([
  'nonce',
  'sid',
  'session_state',
  'jti',
  'iat',
  'nbf',
  'exp',
  'rh',
  'uti',
  'aio',
]);

/**
 * Copy of token claims safe to store as user_identity.idp_attributes.
 * Drops short-lived/session fields; keeps identity and profile-related claims.
 */
export function sanitizeIdpAttributes(
  decoded: Record<string, unknown>,
  omitSet: Set<string> = DEFAULT_OMIT_CLAIMS,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(decoded)) {
    if (omitSet.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export interface JwksMiddlewareOptions {
  jwksUri: string;
  issuer: string;
  audience?: string;
  algorithms?: string[];
}

/**
 * Returns express-jwt middleware using JWKS for RS256 validation.
 */
export function createJwksExpressMiddleware(options: JwksMiddlewareOptions): RequestHandler {
  const { jwksUri, issuer, audience, algorithms = ['RS256'] } = options;
  return jwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      jwksUri,
      handleSigningKeyError: (err, cb) => {
        console.error('Error:', { error: err?.message, stack: err?.stack });
        cb(new Error('Error occurred during authentication'));
      },
    }),
    issuer,
    audience,
    algorithms: algorithms as ['RS256'],
    requestProperty: 'decodedJwt',
    getToken,
  }) as RequestHandler;
}
