/**
 * Typed view of app_user with resolved display fields from profile.
 * Use toAppUserView(row) when you have an app_user row and want .displayName, .email, etc.
 * For stamps, use row.displayLabel directly (already the best label).
 */
import type { InferSelectModel } from 'drizzle-orm';
import { appUsers } from './schema';
import { profileHelpers, type StoredProfile } from '../auth/jwtClaims';

export type AppUserRow = InferSelectModel<typeof appUsers>;

export interface AppUserView extends AppUserRow {
  /** Full display name from profile (name, display_name, or fallbacks). */
  displayName: string | null;
  /** Email from profile. */
  email: string | null;
  /** Preferred username from profile (idir_username, bceid_username, etc.). */
  preferredUsername: string | null;
}

/**
 * Cast an app_user row to a view with resolved display fields.
 * Use this when you need .displayName, .email, .preferredUsername at call sites.
 */
export function toAppUserView(row: AppUserRow): AppUserView {
  const profile = row.profile as StoredProfile | null | undefined;
  return {
    ...row,
    displayName: profileHelpers.getDisplayName(profile),
    email: profileHelpers.getEmail(profile),
    preferredUsername: profileHelpers.getPreferredUsername(profile),
  };
}

/**
 * Minimal user payload for session / frontend (safe to serialize as JSON).
 * All display fields are already resolved; the frontend should use these as-is
 * and not replicate IdP-specific claim precedence or profile mangling.
 */
export interface AppUserSession {
  id: string;
  displayLabel: string | null;
  displayName: string | null;
  email: string | null;
  preferredUsername: string | null;
  status: string;
}

export function toSessionUser(view: AppUserView): AppUserSession {
  return {
    id: view.id,
    displayLabel: view.displayLabel,
    displayName: view.displayName,
    email: view.email,
    preferredUsername: view.preferredUsername,
    status: view.status,
  };
}
