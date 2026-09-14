import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { workspaceGroupMemberships } from '../schema';
import {
  GroupMemberKind,
  PUBLIC_PROVIDER_CODE,
  Permissions,
  SystemGroup,
  WorkspaceGroupMembershipStatus,
} from '../codes';
import type { PermissionCode } from '../codes';
import { getSystemGroupId } from './workspaceGroupRepo';
import { hasAllPermissions, resolveFormPermissions } from './formAccessRepo';

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

/**
 * True when a workspace's Form submitters group admits the caller via a `public` idp member (matches
 * everyone, including anonymous) or an `idp` member matching the caller's provider. User members are
 * not checked here — they are resolved through the staff permission path. idp_group is not resolved yet.
 */
const isSubmitterAudienceMember = async (
  workspaceId: string,
  caller: CallerIdentity,
): Promise<boolean> => {
  const groupId = await getSystemGroupId(workspaceId, SystemGroup.form_submitters);
  if (!groupId) return false;

  // `public` admits everyone; the caller's own provider admits an idp member. One lookup covers both.
  const codes = [PUBLIC_PROVIDER_CODE];
  if (caller.idpCode && caller.idpCode !== PUBLIC_PROVIDER_CODE) {
    codes.push(caller.idpCode);
  }

  const row = await db
    .select({ id: workspaceGroupMemberships.id })
    .from(workspaceGroupMemberships)
    .where(
      and(
        eq(workspaceGroupMemberships.groupId, groupId),
        eq(workspaceGroupMemberships.memberKind, GroupMemberKind.idp),
        inArray(workspaceGroupMemberships.identityProviderCode, codes),
        eq(workspaceGroupMemberships.status, WorkspaceGroupMembershipStatus.active),
      ),
    )
    .limit(1);

  return row.length > 0;
};

/**
 * Authorizes a caller for `required` on a workspace's forms. Grants when the caller's workspace group
 * roles satisfy `required` (staff, incl. user members of the Form submitters group), or, for a code in
 * AUDIENCE_PERMISSIONS, when the caller is in the Form submitters audience via a `public`/`idp` member.
 */
export const hasFormSubmitAccess = async (
  workspaceId: string,
  caller: CallerIdentity,
  required: PermissionCode,
): Promise<boolean> => {
  // Staff permissions apply only to real (non-public) users. The anonymous public user belongs to no
  // workspace, so skip the always-empty permission join and go straight to the audience check.
  if (caller.actorId && caller.idpCode !== PUBLIC_PROVIDER_CODE) {
    const perms = await resolveFormPermissions(caller.actorId, workspaceId);
    if (hasAllPermissions(perms, [required])) return true;
  }
  if (
    AUDIENCE_PERMISSIONS.has(required) &&
    (await isSubmitterAudienceMember(workspaceId, caller))
  ) {
    return true;
  }
  return false;
};
