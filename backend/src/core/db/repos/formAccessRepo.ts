import {
  and,
  eq,
  exists,
  inArray,
  isNull,
  notExists,
  notInArray,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from 'drizzle-orm';
import { unionAll, type AnyPgColumn, type PgSelect } from 'drizzle-orm/pg-core';
import { db } from '../client';
import {
  formGroupOverrideMembers,
  formGroupOverrides,
  forms,
  rolePermissions,
  workspaceGroupMemberships,
  workspaceGroupRoles,
  workspaceGroups,
  workspaceMemberships,
} from '../schema';
import {
  FormGroupOverrideStatus,
  GroupMemberKind,
  Permissions,
  WorkspaceGroupMembershipStatus,
  WorkspaceGroupRoleStatus,
  WorkspaceGroupStatus,
  WorkspaceMembershipStatus,
  type PermissionCode,
} from '../codes';

/** Narrows the groups a caller is an effective member of. */
interface GroupScope {
  workspaceId?: string;
  /** Only these forms: ids, or a subquery returning them. */
  formIds?: string[] | SQLWrapper;
  /** Only groups carrying this role, active. */
  roleCode?: string;
  /** Leave out deleted forms. */
  liveFormsOnly?: boolean;
}

/** The actor a list is filtered for, and the codes each row's form must grant them. */
export interface FormAccessFilter {
  actorId: string;
  required: readonly PermissionCode[];
}

const activeMembershipOf = (userId: string) =>
  and(
    eq(workspaceMemberships.userId, userId),
    eq(workspaceMemberships.status, WorkspaceMembershipStatus.active),
  );

/**
 * The groups the user is an effective member of, per form: a form's active override of a group
 * replaces that group's workspace members with its own. User members only.
 */
export const effectiveGroups = (userId: string, scope: GroupScope) => {
  const activeMembership = and(
    activeMembershipOf(userId),
    scope.workspaceId ? eq(workspaceMemberships.workspaceId, scope.workspaceId) : undefined,
  );
  const inScope = (formId: SQLWrapper) =>
    scope.formIds ? inArray(formId, scope.formIds) : undefined;
  // Checked on the group before its forms are joined, so other groups never reach the forms.
  const carriesRole = scope.roleCode
    ? exists(
        db
          .select({ id: workspaceGroupRoles.id })
          .from(workspaceGroupRoles)
          .where(
            and(
              eq(workspaceGroupRoles.groupId, workspaceGroups.id),
              eq(workspaceGroupRoles.status, WorkspaceGroupRoleStatus.active),
              eq(workspaceGroupRoles.roleCode, scope.roleCode),
            ),
          ),
      )
    : undefined;
  const live = scope.liveFormsOnly ? isNull(forms.deletedAt) : undefined;
  // Drizzle does not qualify a subquery's aliased columns, so the names must not match a table's.
  const formId = sql<string>`${forms.id}`.as('effective_form_id');
  const groupId = sql<string>`${workspaceGroups.id}`.as('effective_group_id');

  const inherited = db
    .select({ formId, groupId })
    .from(workspaceMemberships)
    .innerJoin(
      workspaceGroupMemberships,
      and(
        eq(workspaceGroupMemberships.workspaceMembershipId, workspaceMemberships.id),
        eq(workspaceGroupMemberships.workspaceId, workspaceMemberships.workspaceId),
        eq(workspaceGroupMemberships.memberKind, GroupMemberKind.user),
        eq(workspaceGroupMemberships.status, WorkspaceGroupMembershipStatus.active),
      ),
    )
    .innerJoin(
      workspaceGroups,
      and(
        eq(workspaceGroups.id, workspaceGroupMemberships.groupId),
        eq(workspaceGroups.status, WorkspaceGroupStatus.active),
        carriesRole,
      ),
    )
    .innerJoin(
      forms,
      and(eq(forms.workspaceId, workspaceMemberships.workspaceId), inScope(forms.id), live),
    )
    .where(
      and(
        activeMembership,
        notExists(
          db
            .select({ id: formGroupOverrides.id })
            .from(formGroupOverrides)
            .where(
              and(
                eq(formGroupOverrides.formId, forms.id),
                eq(formGroupOverrides.groupId, workspaceGroups.id),
                eq(formGroupOverrides.status, FormGroupOverrideStatus.active),
              ),
            ),
        ),
      ),
    );

  const overridden = db
    .select({ formId, groupId })
    .from(workspaceMemberships)
    .innerJoin(
      formGroupOverrideMembers,
      and(
        eq(formGroupOverrideMembers.workspaceMembershipId, workspaceMemberships.id),
        eq(formGroupOverrideMembers.memberKind, GroupMemberKind.user),
        eq(formGroupOverrideMembers.status, WorkspaceGroupMembershipStatus.active),
      ),
    )
    .innerJoin(
      formGroupOverrides,
      and(
        eq(formGroupOverrides.id, formGroupOverrideMembers.overrideId),
        eq(formGroupOverrides.workspaceId, workspaceMemberships.workspaceId),
        eq(formGroupOverrides.status, FormGroupOverrideStatus.active),
        inScope(formGroupOverrides.formId),
      ),
    )
    .innerJoin(
      workspaceGroups,
      and(
        eq(workspaceGroups.id, formGroupOverrides.groupId),
        eq(workspaceGroups.status, WorkspaceGroupStatus.active),
        carriesRole,
      ),
    )
    .innerJoin(
      forms,
      and(
        eq(forms.id, formGroupOverrides.formId),
        eq(forms.workspaceId, workspaceMemberships.workspaceId),
        live,
      ),
    )
    .where(activeMembership);

  return unionAll(inherited, overridden);
};

/** Joins the active roles of the group in `groupId`, and their permission codes. */
const withRolePermissions = <T extends PgSelect>(query: T, groupId: SQLWrapper) =>
  query
    .innerJoin(
      workspaceGroupRoles,
      and(
        eq(workspaceGroupRoles.groupId, groupId),
        eq(workspaceGroupRoles.status, WorkspaceGroupRoleStatus.active),
      ),
    )
    .innerJoin(rolePermissions, eq(rolePermissions.roleCode, workspaceGroupRoles.roleCode));

/** Per form, the user's permission codes from the active roles of their effective groups. */
export const permissionsByForm = (userId: string, scope: GroupScope) => {
  const groups = effectiveGroups(userId, scope).as('effective_group');
  return withRolePermissions(
    db
      .select({
        formId: groups.formId,
        permissions: sql<string[]>`array_agg(distinct ${rolePermissions.permissionCode})`.as(
          'access_permissions',
        ),
      })
      .from(groups)
      .$dynamic(),
    groups.groupId,
  ).groupBy(groups.formId);
};

/**
 * Joins, onto workspace_membership, the member's active groups and the permission codes of those
 * groups' active roles. User members only; form overrides are not applied.
 */
const withGroupPermissions = <T extends PgSelect>(query: T) =>
  withRolePermissions(
    query
      .innerJoin(
        workspaceGroupMemberships,
        and(
          eq(workspaceGroupMemberships.workspaceMembershipId, workspaceMemberships.id),
          eq(workspaceGroupMemberships.workspaceId, workspaceMemberships.workspaceId),
          eq(workspaceGroupMemberships.memberKind, GroupMemberKind.user),
          eq(workspaceGroupMemberships.status, WorkspaceGroupMembershipStatus.active),
        ),
      )
      .innerJoin(
        workspaceGroups,
        and(
          eq(workspaceGroups.id, workspaceGroupMemberships.groupId),
          eq(workspaceGroups.status, WorkspaceGroupStatus.active),
        ),
      ),
    workspaceGroups.id,
  );

/** For a grouped role_permission set: the '*' wildcard, or every code in `required`. */
const holdsAll = (required: readonly string[]): SQL => {
  const codes = [...new Set(required)];
  return sql`bool_or(${eq(rolePermissions.permissionCode, Permissions.all)}) or count(distinct ${rolePermissions.permissionCode}) filter (where ${inArray(rolePermissions.permissionCode, codes)}) = ${codes.length}`;
};

/**
 * Permission codes the user holds across a workspace, from the roles of the workspace groups they
 * belong to, without any form's overrides. A returned set containing '*' grants everything.
 */
export const resolveWorkspacePermissions = async (
  actorId: string,
  workspaceId: string,
): Promise<Set<string>> => {
  const rows = await withGroupPermissions(
    db
      .selectDistinct({ permissionCode: rolePermissions.permissionCode })
      .from(workspaceMemberships)
      .$dynamic(),
  ).where(and(activeMembershipOf(actorId), eq(workspaceMemberships.workspaceId, workspaceId)));

  return new Set(rows.map((row) => row.permissionCode));
};

/**
 * Permission codes the user holds on one form, with the form's group overrides applied. A returned
 * set containing '*' grants everything.
 */
export const resolveFormPermissions = async (
  actorId: string,
  workspaceId: string,
  formId: string,
): Promise<Set<string>> => {
  const rows = await permissionsByForm(actorId, { workspaceId, formIds: [formId] });
  return new Set(rows[0]?.permissions ?? []);
};

/** A table's workspace and form columns. */
interface FormColumns {
  workspaceId: AnyPgColumn;
  formId: AnyPgColumn;
}

/**
 * Keeps rows whose form the actor holds every required code on. A form without an active override
 * takes the actor's workspace permissions; a form with one takes its own from the actor's effective
 * groups.
 */
export const permittedFormsWhere = (
  filter: FormAccessFilter,
  workspaceIds: string[],
  columns: FormColumns,
): SQL => {
  const overriddenForms = db
    .select({ formId: formGroupOverrides.formId })
    .from(formGroupOverrides)
    .where(
      and(
        inArray(formGroupOverrides.workspaceId, workspaceIds),
        eq(formGroupOverrides.status, FormGroupOverrideStatus.active),
      ),
    );

  const grantingWorkspaces = withGroupPermissions(
    db
      .select({ workspaceId: workspaceMemberships.workspaceId })
      .from(workspaceMemberships)
      .$dynamic(),
  )
    .where(
      and(
        activeMembershipOf(filter.actorId),
        inArray(workspaceMemberships.workspaceId, workspaceIds),
      ),
    )
    .groupBy(workspaceMemberships.workspaceId)
    .having(holdsAll(filter.required));

  const groups = effectiveGroups(filter.actorId, { formIds: overriddenForms }).as(
    'overridden_group',
  );
  const grantingOverriddenForms = withRolePermissions(
    db.select({ formId: groups.formId }).from(groups).$dynamic(),
    groups.groupId,
  )
    .groupBy(groups.formId)
    .having(holdsAll(filter.required));

  return or(
    and(
      inArray(columns.workspaceId, grantingWorkspaces),
      notInArray(columns.formId, overriddenForms),
    ),
    inArray(columns.formId, grantingOverriddenForms),
  );
};
