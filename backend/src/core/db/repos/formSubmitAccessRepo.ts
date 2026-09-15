import { GroupMemberKind, PUBLIC_PROVIDER_CODE, Permissions, SystemGroup } from '../codes';
import type { PermissionCode } from '../codes';
import { getSystemGroupId } from './workspaceGroupRepo';
import { hasAllPermissions, resolveFormPermissionsForForm } from './formAccessRepo';
import { effectiveGroupMembers } from './formGroupOverrideRepo';

/**
 * Permissions the Form submitters audience conveys to non-staff (idp/public) members: read the form,
 * submit to it, read a submission (on a public form submissions are public data), and read the form's
 * document templates. Anything else (mutations, submission list) stays staff-only.
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
 * True when the form's effective Form submitters members (the form's override, else the workspace
 * group) admit the caller via a `public` idp member (matches everyone, including anonymous) or an `idp`
 * member matching the caller's provider. User members are not checked here; they are resolved through
 * the staff permission path. idp_group is not resolved yet.
 */
const isSubmitterAudienceMember = async (
  target: FormAccessTarget,
  caller: CallerIdentity,
): Promise<boolean> => {
  const groupId = await getSystemGroupId(target.workspaceId, SystemGroup.form_submitters);
  if (!groupId) return false;

  const codes = new Set<string>([PUBLIC_PROVIDER_CODE]);
  if (caller.idpCode) codes.add(caller.idpCode);

  const members = await effectiveGroupMembers({
    workspaceId: target.workspaceId,
    formId: target.formId,
    groupId,
    memberKind: GroupMemberKind.idp,
  });
  return members.some((m) => m.identityProviderCode != null && codes.has(m.identityProviderCode));
};

/**
 * Authorizes a caller for `required` on a form. Grants when the roles of the groups the caller is an
 * effective member of for this form satisfy `required` (staff, incl. user members of the Form
 * submitters group, where a form's override of a group replaces its members), or, for a code in
 * AUDIENCE_PERMISSIONS, when the caller is in the form's Form submitters audience via a `public`/`idp`
 * member.
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
  return AUDIENCE_PERMISSIONS.has(required) && (await isSubmitterAudienceMember(target, caller));
};
