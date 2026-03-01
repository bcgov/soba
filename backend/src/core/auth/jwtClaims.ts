/**
 * Normalized profile from token; stored in app_user.profile.
 * Only sub and identity_provider are common across IdPs; the rest are best-effort from token.
 */
export interface NormalizedProfile {
  displayName?: string | null;
  email?: string | null;
  preferredUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** Raw "name" claim (idir/bceid fullName). Used for displayLabel precedence. */
  name?: string | null;
  /** IDIR username (e.g. IMONTOYA). Stored so displayLabel can prefer it over preferred_username. */
  idir_username?: string | null;
  /** BCeID username. Stored so displayLabel can prefer it over preferred_username. */
  bceid_username?: string | null;
}

/** Shape of app_user.profile (same as NormalizedProfile). Use profileHelpers for display. */
export type StoredProfile = NormalizedProfile;

/**
 * Stored as user_identity.idp_attributes.
 * Full token payload (or sanitized subset) for audit and IdP-specific use.
 */
export type IdpAttributes = Record<string, unknown>;

/** Known OIDC / BC Gov claim names used by different IdPs (e.g. IDIR, Azure IDIR, BCeID, BC Services Card). */
const CLAIM_DISPLAY_NAME = [
  'display_name',
  'display_name_alt',
  'name', // idir/bceid fullName; bcsc uses literal "anonymous"
] as const;
const CLAIM_EMAIL = ['email', 'user_principal_name', 'upn', 'preferred_username'] as const;

/** firstName: given_name (idir), given_names (bcservicescard); bceid null. */
const CLAIM_FIRST_NAME = ['given_name', 'given_names'] as const;
/** lastName: family_name (idir, bcservicescard); bceid null. */
const CLAIM_LAST_NAME = ['family_name'] as const;

/**
 * IdP-specific username claims (clean, human-friendly).
 * Prefer these over preferred_username, which is often sub@idp (e.g. 584861aa...@azureidir).
 * Order: IDIR/Azure IDIR, then BCeID variants, then generic fallbacks.
 * @see https://github.com/bcgov/sso-keycloak/tree/dev/idp-payload
 */
const CLAIM_USERNAME = [
  'idir_username', // IDIR / Azure IDIR (e.g. IMONTOYA)
  'bceid_username', // BCeID Basic/Business
  'preferred_username', // fallback (may be email or sub@idp)
  'sub',
] as const;

const firstString = (claims: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const v = claims[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
};

/** Only treat as email if it contains @ (preferred_username can be idir_username). */
const firstEmailLike = (
  claims: Record<string, unknown>,
  keys: readonly string[],
): string | null => {
  const s = firstString(claims, keys);
  return s && s.includes('@') ? s : null;
};

/**
 * Builds a minimal, consistent profile from any IdP token.
 * Claim precedence aligns with BC Gov SSO Keycloak idp-payload mappings where applicable.
 * @see https://github.com/bcgov/sso-keycloak/tree/dev/idp-payload
 */
export function normalizeProfileFromJwt(decoded: Record<string, unknown>): NormalizedProfile {
  const displayName =
    firstString(decoded, CLAIM_DISPLAY_NAME) ||
    (() => {
      const given = typeof decoded.given_name === 'string' ? decoded.given_name.trim() : '';
      const family = typeof decoded.family_name === 'string' ? decoded.family_name.trim() : '';
      if (given || family) return [given, family].filter(Boolean).join(' ').trim();
      return null;
    })() ||
    firstString(decoded, CLAIM_USERNAME) ||
    (typeof decoded.sub === 'string' ? decoded.sub : null);

  const email =
    firstEmailLike(decoded, CLAIM_EMAIL) || firstEmailLike(decoded, ['preferred_username']);

  // Prefer IdP-specific username (e.g. idir_username -> IMONTOYA) over preferred_username (often sub@idp).
  // BC Services Card: tokenmap uses anonymous::raw -> literal "anonymous" when no username in token.
  let preferredUsername =
    firstString(decoded, CLAIM_USERNAME) || (typeof decoded.sub === 'string' ? decoded.sub : null);
  const idp =
    typeof decoded.identity_provider === 'string' ? decoded.identity_provider.toLowerCase() : '';
  if (!preferredUsername && (idp === 'bcservicescard' || idp === 'bcsc')) {
    preferredUsername = 'anonymous';
  }

  const firstName = firstString(decoded, CLAIM_FIRST_NAME) ?? null;
  const lastName = firstString(decoded, CLAIM_LAST_NAME) ?? null;

  const name = firstString(decoded, ['name']) ?? null;
  const idirUsername = firstString(decoded, ['idir_username']) ?? null;
  const bceidUsername = firstString(decoded, ['bceid_username']) ?? null;

  return {
    displayName: displayName ?? null,
    email: email ?? null,
    preferredUsername: preferredUsername ?? null,
    firstName,
    lastName,
    name,
    idir_username: idirUsername,
    bceid_username: bceidUsername,
  };
}

/**
 * Copy of token claims safe to store as user_identity.idp_attributes.
 * Drops short-lived/session fields that change every login; keeps identity and profile-related claims.
 */
export function idpAttributesFromJwt(decoded: Record<string, unknown>): IdpAttributes {
  const omit = new Set([
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
  const out: IdpAttributes = {};
  for (const [k, v] of Object.entries(decoded)) {
    if (omit.has(k)) continue;
    out[k] = v;
  }
  return out;
}

/** True if value looks like a normalized profile (has displayName, email, or preferredUsername) rather than raw token claims. */
function isStoredProfile(v: Record<string, unknown>): boolean {
  return 'displayName' in v || 'email' in v || 'preferredUsername' in v;
}

/**
 * Resolve a normalized profile from either app_user.profile (StoredProfile) or user_identity.idp_attributes (raw token).
 * Use with profile display helpers when you have profile or idp_attributes.
 */
export function profileFromSource(
  source: StoredProfile | IdpAttributes | null | undefined,
): NormalizedProfile {
  if (!source || typeof source !== 'object') return {};
  if (isStoredProfile(source as Record<string, unknown>)) return source as NormalizedProfile;
  return normalizeProfileFromJwt(source as Record<string, unknown>);
}

/**
 * Helpers to read display attributes from app_user.profile or user_identity.idp_attributes.
 * Use these instead of reading profile fields directly so both stored profile and raw token work.
 */
export const profileHelpers = {
  getDisplayName(source: StoredProfile | IdpAttributes | null | undefined): string | null {
    const p = profileFromSource(source);
    return p.displayName ?? null;
  },
  getEmail(source: StoredProfile | IdpAttributes | null | undefined): string | null {
    const p = profileFromSource(source);
    return p.email ?? null;
  },
  getPreferredUsername(source: StoredProfile | IdpAttributes | null | undefined): string | null {
    const p = profileFromSource(source);
    return p.preferredUsername ?? null;
  },
  getFirstName(source: StoredProfile | IdpAttributes | null | undefined): string | null {
    const p = profileFromSource(source);
    return p.firstName ?? null;
  },
  getLastName(source: StoredProfile | IdpAttributes | null | undefined): string | null {
    const p = profileFromSource(source);
    return p.lastName ?? null;
  },
  /**
   * Best single value for user stamps / audit display.
   * Order: idir_username, bceid_username, email, name, displayName, preferred_username, subject.
   * (Do not use preferred_username from token for IDIR/BCeID before email/name.)
   */
  getDisplayLabel(
    source: StoredProfile | IdpAttributes | null | undefined,
    fallbackSub?: string | null,
  ): string | null {
    const p = profileFromSource(source);
    const idir = p.idir_username ?? null;
    const bceid = p.bceid_username ?? null;
    const email = p.email ?? null;
    const name = p.name ?? null;
    const displayName = p.displayName ?? null;
    const preferred = p.preferredUsername ?? null;
    if (idir && idir.length > 0) return idir;
    if (bceid && bceid.length > 0) return bceid;
    if (email && email.length > 0) return email;
    if (name && name.length > 0) return name;
    if (displayName && displayName.length > 0) return displayName;
    if (preferred && preferred.length > 0) return preferred;
    return fallbackSub ?? null;
  },
};
