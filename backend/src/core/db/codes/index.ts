/**
 * Single source of truth for all seeded code values. Seed and application code
 * import from here; no string literals for codes in logic. Compile-time safety.
 */

export const Roles = {
  // Form roles. form_admin holds the `*` wildcard permission.
  form_admin: 'form_admin',
  form_designer: 'form_designer',
  form_submitter: 'form_submitter',
  submission_reviewer: 'submission_reviewer',
  submission_approver: 'submission_approver',
} as const;
export type RoleCode = (typeof Roles)[keyof typeof Roles];

/** Form permissions. `all` is the `*` wildcard, held only by form_admin. */
export const Permissions = {
  all: '*',
  form_read: 'form_read',
  form_update: 'form_update',
  form_delete: 'form_delete',
  design_create: 'design_create',
  design_read: 'design_read',
  design_update: 'design_update',
  design_delete: 'design_delete',
  submission_create: 'submission_create',
  submission_read: 'submission_read',
  submission_update: 'submission_update',
  submission_delete: 'submission_delete',
  submission_review: 'submission_review',
  team_read: 'team_read',
  team_update: 'team_update',
} as const;
export type PermissionCode = (typeof Permissions)[keyof typeof Permissions];

export const RoleStatus = {
  active: 'active',
  deprecated: 'deprecated',
} as const;
export type RoleStatusCode = (typeof RoleStatus)[keyof typeof RoleStatus];

export const WorkspaceMembershipRole = {
  owner: 'owner',
  admin: 'admin',
  member: 'member',
  viewer: 'viewer',
} as const;
export type WorkspaceMembershipRoleCode =
  (typeof WorkspaceMembershipRole)[keyof typeof WorkspaceMembershipRole];

export const WorkspaceMembershipStatus = {
  active: 'active',
  inactive: 'inactive',
  pending: 'pending',
} as const;
export type WorkspaceMembershipStatusCode =
  (typeof WorkspaceMembershipStatus)[keyof typeof WorkspaceMembershipStatus];

export const FormStatus = {
  active: 'active',
  archived: 'archived',
  deleted: 'deleted',
} as const;
export type FormStatusCode = (typeof FormStatus)[keyof typeof FormStatus];

export const FormVersionState = {
  draft: 'draft',
  published: 'published',
  archived: 'archived',
  deleted: 'deleted',
} as const;
export type FormVersionStateCode = (typeof FormVersionState)[keyof typeof FormVersionState];

export const FeatureStatus = {
  enabled: 'enabled',
  disabled: 'disabled',
  experimental: 'experimental',
  deprecated: 'deprecated',
} as const;
export type FeatureStatusCode = (typeof FeatureStatus)[keyof typeof FeatureStatus];

/** Display name for the group that grants form admin on all forms in a workspace. */
export const FORM_ADMINS_GROUP_NAME = 'Form administrators';

/** Display name for the group that grants form submit access in a workspace. */
export const FORM_SUBMITTERS_GROUP_NAME = 'Form submitters';

/** Logical IDP groups (see idp_group / idp_group_member). */
export const IdpGroups = {
  bcgov: 'bcgov',
  bceid: 'bceid',
} as const;
export type IdpGroupCode = (typeof IdpGroups)[keyof typeof IdpGroups];

/** Pseudo identity provider that grants public (unauthenticated) submit access. */
export const PUBLIC_PROVIDER_CODE = 'public';

/** Marks the two bootstrap groups carrying team-guard protections (see workspace_group.system_code). */
export const SystemGroup = {
  form_admins: 'form_admins',
  form_submitters: 'form_submitters',
} as const;
export type SystemGroupCode = (typeof SystemGroup)[keyof typeof SystemGroup];

/** Kind of a workspace group member (see workspace_group_membership.member_kind). */
export const GroupMemberKind = {
  user: 'user',
  idp: 'idp',
  idp_group: 'idp_group',
} as const;
export type GroupMemberKindCode = (typeof GroupMemberKind)[keyof typeof GroupMemberKind];

/** Membership source when created automatically as user's home workspace. */
export const WorkspaceMembershipSource = {
  auto_home: 'auto_home',
  user_created: 'user_created',
} as const;
export type WorkspaceMembershipSourceCode =
  (typeof WorkspaceMembershipSource)[keyof typeof WorkspaceMembershipSource];
