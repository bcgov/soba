/**
 * Normalized profile stored in app_user.profile.
 * Core only defines the common shape; plugins set displayLabel when mapping from their token.
 */
export interface NormalizedProfile {
  displayName?: string | null;
  email?: string | null;
  preferredUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** Single display label for user stamps/audit; set by IdP plugin when mapping. */
  displayLabel?: string | null;
  /** Optional extras for backward compatibility with stored profiles (e.g. name, idir_username, bceid_username). Core does not use these for displayLabel precedence. */
  [key: string]: unknown;
}

/** Shape of app_user.profile (same as NormalizedProfile). Use profileHelpers for display. */
export type StoredProfile = NormalizedProfile;

/**
 * Stored as user_identity.idp_attributes.
 * Full token payload (or sanitized subset) for audit and IdP-specific use.
 */
export type IdpAttributes = Record<string, unknown>;

/** True if value looks like a normalized profile (has displayName, email, or preferredUsername) rather than raw token claims. */
function isStoredProfile(v: Record<string, unknown>): boolean {
  return 'displayName' in v || 'email' in v || 'preferredUsername' in v;
}

/**
 * Resolve a normalized profile from either app_user.profile (StoredProfile) or user_identity.idp_attributes (raw token).
 * When source is raw token, returns it as-is; displayLabel and other fields may be absent (plugins set them when creating users).
 */
export function profileFromSource(
  source: StoredProfile | IdpAttributes | null | undefined,
): NormalizedProfile {
  if (!source || typeof source !== 'object') return {};
  if (isStoredProfile(source as Record<string, unknown>)) return source as NormalizedProfile;
  return source as NormalizedProfile;
}

/**
 * Helpers to read display attributes from app_user.profile or user_identity.idp_attributes.
 * IdP-agnostic: only uses common fields and displayLabel (no idir_username/bceid_username precedence).
 */
export const profileHelpers = {
  getDisplayName(source: StoredProfile | IdpAttributes | null | undefined): string | null {
    const p = profileFromSource(source);
    return (p.displayName as string | null | undefined) ?? null;
  },
  getEmail(source: StoredProfile | IdpAttributes | null | undefined): string | null {
    const p = profileFromSource(source);
    return (p.email as string | null | undefined) ?? null;
  },
  getPreferredUsername(source: StoredProfile | IdpAttributes | null | undefined): string | null {
    const p = profileFromSource(source);
    return (p.preferredUsername as string | null | undefined) ?? null;
  },
  getFirstName(source: StoredProfile | IdpAttributes | null | undefined): string | null {
    const p = profileFromSource(source);
    return (p.firstName as string | null | undefined) ?? null;
  },
  getLastName(source: StoredProfile | IdpAttributes | null | undefined): string | null {
    const p = profileFromSource(source);
    return (p.lastName as string | null | undefined) ?? null;
  },
  /**
   * Best single value for user stamps / audit display.
   * Prefers plugin-set displayLabel, then displayName, email, name, preferredUsername, fallbackSub.
   */
  getDisplayLabel(
    source: StoredProfile | IdpAttributes | null | undefined,
    fallbackSub?: string | null,
  ): string | null {
    const p = profileFromSource(source);
    const displayLabel = (p.displayLabel as string | null | undefined) ?? null;
    const displayName = (p.displayName as string | null | undefined) ?? null;
    const email = (p.email as string | null | undefined) ?? null;
    const name = (p.name as string | null | undefined) ?? null;
    const preferred = (p.preferredUsername as string | null | undefined) ?? null;
    if (displayLabel && displayLabel.length > 0) return displayLabel;
    if (displayName && displayName.length > 0) return displayName;
    if (email && email.length > 0) return email;
    if (name && name.length > 0) return name;
    if (preferred && preferred.length > 0) return preferred;
    return fallbackSub ?? null;
  },
};
