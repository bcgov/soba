/**
 * Claim helpers specific to BC Gov SSO. Shared JWKS verification lives in core/auth/jwks.
 */

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
  return s?.includes('@') ? s : null;
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
  'azp',
  'aud',
  'scope',
  'client_roles',
]);

/**
 * Copy of token claims safe to store as user_identity.idp_attributes.
 * Drops short-lived/session fields and those of the client the token was issued to; keeps identity
 * and profile-related claims.
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
