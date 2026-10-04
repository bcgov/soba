import { PUBLIC_PROVIDER_CODE, Permissions } from '../codes';
import type { PermissionCode } from '../codes';
import { hasAllPermissions, resolveFormPermissionsForForm } from './formAccessRepo';
import { findEffectiveAudience } from './audienceSettingRepo';

/**
 * Permissions a form's audience conveys to people outside the workspace. Anything else (mutations,
 * submission list) stays staff-only. Submit mode never reads a submission through this set; reads
 * go by participation (services/submitterAccess).
 */
const AUDIENCE_PERMISSIONS = new Set<PermissionCode>([
  Permissions.form_read,
  Permissions.submission_create,
  Permissions.submission_read,
  Permissions.document_template_read,
]);

/** The identity of a caller on the public read/submit paths (the public user for anonymous). */
export interface CallerIdentity {
  /** Resolved app_user id (the seeded public user for anonymous callers). */
  actorId?: string | null;
  /** The caller's identity provider code (lowercased); `public` for anonymous. */
  idpCode?: string | null;
}

/** The form an access check is for, with the workspace that owns it. */
export interface FormAccessTarget {
  workspaceId: string;
  formId: string;
}

/**
 * True when the form's audience admits the caller: public admits everyone, including anonymous;
 * protected admits callers signed in through one of its providers; members admits no one.
 */
const isAudienceMember = async (
  target: FormAccessTarget,
  caller: CallerIdentity,
): Promise<boolean> => {
  const audience = await findEffectiveAudience(target);
  if (audience?.mode === 'public') return true;
  return (
    audience?.mode === 'protected' && !!caller.idpCode && audience.idps.includes(caller.idpCode)
  );
};

/** True when the form's audience is public. */
export const isPublicAudience = async (target: FormAccessTarget): Promise<boolean> =>
  (await findEffectiveAudience(target))?.mode === 'public';

/**
 * Authorizes a caller for `required` on a form. Grants when the roles of the groups the caller is an
 * effective member of for this form satisfy `required` (staff and anyone given a submit role, where
 * a form's override of a group replaces its members), or, for a code in AUDIENCE_PERMISSIONS, when
 * the form's audience admits the caller.
 */
export const hasFormSubmitAccess = async (
  target: FormAccessTarget,
  caller: CallerIdentity,
  required: PermissionCode,
): Promise<boolean> => {
  // Staff permissions apply only to real (non-public) users. The anonymous public user belongs to no
  // workspace, so skip the always-empty permission join and go straight to the audience check.
  if (caller.actorId && caller.idpCode !== PUBLIC_PROVIDER_CODE) {
    const perms = await resolveFormPermissionsForForm(caller.actorId, target);
    if (hasAllPermissions(perms, [required])) return true;
  }
  return AUDIENCE_PERMISSIONS.has(required) && (await isAudienceMember(target, caller));
};
