/**
 * Single source of truth for all seeded code values. Seed and application code
 * import from here; no string literals for codes in logic. Compile-time safety.
 */

export const Roles = {
  workspace_owner: 'workspace_owner',
  form_owner: 'form_owner',
} as const;
export type RoleCode = (typeof Roles)[keyof typeof Roles];

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

/** Display name for the workspace owners group (role_code = Roles.workspace_owner). */
export const WORKSPACE_OWNERS_GROUP_NAME = 'Workspace owners';

/** Membership source when created automatically as user's home workspace. */
export const WorkspaceMembershipSource = {
  auto_home: 'auto_home',
} as const;
export type WorkspaceMembershipSourceCode =
  (typeof WorkspaceMembershipSource)[keyof typeof WorkspaceMembershipSource];
