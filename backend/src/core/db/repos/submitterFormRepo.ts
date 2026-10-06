import {
  and,
  count,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  notExists,
  sql,
  type SQL,
  type SQLWrapper,
} from 'drizzle-orm';
import { unionAll, type PgSelect } from 'drizzle-orm/pg-core';
import {
  MY_FORM_SORT_FIELDS,
  MY_SUBMISSION_STATES,
  type AudienceMode,
  type DraftSaveFacts,
  type FormAccessFacts,
  type MyFormListSort,
  type SortLocale,
  type SubmitterFormFacts,
} from '@soba/lib';
import { db } from '../client';
import {
  formAudienceSettings,
  formGroupOverrideMembers,
  formGroupOverrides,
  forms,
  formSubmitterSettings,
  formVersions,
  rolePermissions,
  submissionParticipants,
  submissions,
  workspaceAudienceSettings,
  workspaceGroupMemberships,
  workspaceGroupRoles,
  workspaceGroups,
  workspaceMemberships,
  workspaceSubmitterSettings,
  workspaces,
} from '../schema';
import {
  FormGroupOverrideStatus,
  FormVersionState,
  GroupMemberKind,
  Roles,
  SubmissionParticipantStatus,
  WorkspaceGroupMembershipStatus,
  WorkspaceGroupRoleStatus,
  WorkspaceGroupStatus,
  WorkspaceMembershipStatus,
} from '../codes';
import { collated, likePattern, orderByForSort, type SortColumns } from '../listSort';
import { readListPage } from '../listRead';

type SubmitterFormSortField = (typeof MY_FORM_SORT_FIELDS)[number];

const SUBMITTER_FORM_SORT_COLUMNS: SortColumns<SubmitterFormSortField> = {
  name: { column: forms.name, linguistic: true },
};

export interface SubmitterFormListRow extends SubmitterFormFacts {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
}

/** What the access and drafts rules read about one form for one caller. */
export type FormRuleFacts = FormAccessFacts & DraftSaveFacts;

export interface ListSubmitterFormsInput {
  userId: string;
  offset: number;
  limit: number;
  workspaceId?: string;
  q?: string;
  sort: MyFormListSort;
  locale: SortLocale;
}

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

const isPublished = and(
  eq(formVersions.state, FormVersionState.published),
  isNull(formVersions.deletedAt),
);

const hasPublishedVersion = (formId: SQLWrapper): SQL =>
  exists(
    db
      .select({ id: formVersions.id })
      .from(formVersions)
      .where(and(eq(formVersions.formId, formId), isPublished)),
  );

const publishedVersionIdOf = (formId: SQLWrapper) =>
  sql<string | null>`(${db
    .select({ id: formVersions.id })
    .from(formVersions)
    .where(and(eq(formVersions.formId, formId), isPublished))
    .limit(1)})`;

/**
 * The groups the user is an effective member of, per form: a form's active override of a group
 * replaces that group's workspace members with its own. User members only.
 */
const effectiveGroups = (userId: string, scope: GroupScope) => {
  const activeMembership = and(
    eq(workspaceMemberships.userId, userId),
    eq(workspaceMemberships.status, WorkspaceMembershipStatus.active),
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

/** Per form, the user's permission codes from the active roles of their effective groups. */
const permissionsByForm = (userId: string, scope: GroupScope) => {
  const groups = effectiveGroups(userId, scope).as('effective_group');
  return db
    .select({
      formId: groups.formId,
      permissions: sql<string[]>`array_agg(distinct ${rolePermissions.permissionCode})`.as(
        'access_permissions',
      ),
    })
    .from(groups)
    .innerJoin(
      workspaceGroupRoles,
      and(
        eq(workspaceGroupRoles.groupId, groups.groupId),
        eq(workspaceGroupRoles.status, WorkspaceGroupRoleStatus.active),
      ),
    )
    .innerJoin(rolePermissions, eq(rolePermissions.roleCode, workspaceGroupRoles.roleCode))
    .groupBy(groups.formId);
};

/**
 * Ids of the forms the user holds the form_submitter role on, plus the forms of their draft and
 * submitted submissions, as listSubmissionsForParticipant lists them. Only that role lists a form,
 * not every role granting submission_create. Role forms need a published version; history forms
 * do not.
 */
const submitterFormIds = (userId: string, workspaceId?: string) => {
  const submitterGroups = effectiveGroups(userId, {
    workspaceId,
    roleCode: Roles.form_submitter,
    liveFormsOnly: true,
  }).as('submitter_group');
  const byRole = db
    .select({ formId: submitterGroups.formId })
    .from(submitterGroups)
    .where(hasPublishedVersion(submitterGroups.formId));

  const byHistory = db
    .select({ formId: submissions.formId })
    .from(submissionParticipants)
    .innerJoin(
      submissions,
      and(eq(submissions.id, submissionParticipants.submissionId), isNull(submissions.deletedAt)),
    )
    .innerJoin(
      formVersions,
      and(eq(formVersions.id, submissions.formVersionId), isNull(formVersions.deletedAt)),
    )
    .where(
      and(
        eq(submissionParticipants.userId, userId),
        eq(submissionParticipants.status, SubmissionParticipantStatus.active),
        workspaceId ? eq(submissionParticipants.workspaceId, workspaceId) : undefined,
        inArray(submissions.workflowState, [...MY_SUBMISSION_STATES]),
      ),
    );

  // IN ignores duplicates, so the branches skip a de-duplicating UNION.
  return unionAll(byRole, byHistory);
};

/**
 * The effective audience and drafts setting: the form's own unless it inherits or leaves the value
 * unset, then the workspace's. A form without both rows of a pair has neither. The same rule as
 * findFormAudience and toInheritableSettings, which the settings screens read.
 */
const settingsColumns = {
  audienceMode: sql<AudienceMode | null>`case
    when ${workspaceAudienceSettings.workspaceId} is null then null
    when ${formAudienceSettings.inherit} or ${formAudienceSettings.mode} is null
      then ${workspaceAudienceSettings.mode}
    else ${formAudienceSettings.mode} end`,
  audienceIdps: sql<string[]>`case
    when ${workspaceAudienceSettings.workspaceId} is null then '{}'::text[]
    when ${formAudienceSettings.inherit} or ${formAudienceSettings.mode} is null
      then ${workspaceAudienceSettings.idps}
    else coalesce(${formAudienceSettings.idps}, '{}'::text[]) end`,
  allowSubmitterDrafts: sql<boolean>`coalesce(case
    when ${workspaceSubmitterSettings.workspaceId} is null then null
    when ${formSubmitterSettings.inherit} or ${formSubmitterSettings.allowSubmitterDrafts} is null
      then ${workspaceSubmitterSettings.allowSubmitterDrafts}
    else ${formSubmitterSettings.allowSubmitterDrafts} end, false)`,
};

/** Joins the settings rows settingsColumns reads; each pair has one row per form and workspace. */
const withSettings = <T extends PgSelect>(query: T) =>
  query
    .leftJoin(
      formAudienceSettings,
      and(
        eq(formAudienceSettings.formId, forms.id),
        eq(formAudienceSettings.workspaceId, forms.workspaceId),
      ),
    )
    .leftJoin(
      workspaceAudienceSettings,
      eq(workspaceAudienceSettings.workspaceId, formAudienceSettings.workspaceId),
    )
    .leftJoin(
      formSubmitterSettings,
      and(
        eq(formSubmitterSettings.formId, forms.id),
        eq(formSubmitterSettings.workspaceId, forms.workspaceId),
      ),
    )
    .leftJoin(
      workspaceSubmitterSettings,
      eq(workspaceSubmitterSettings.workspaceId, formSubmitterSettings.workspaceId),
    );

const NO_PERMISSIONS = sql<string[]>`'{}'::text[]`;

/** One page of the forms the user holds the submitter role on or has submitted to, with facts. */
export const listFormsForSubmitter = async (
  input: ListSubmitterFormsInput,
): Promise<{ items: SubmitterFormListRow[]; total: number }> => {
  const where = and(
    inArray(forms.id, submitterFormIds(input.userId, input.workspaceId)),
    isNull(forms.deletedAt),
    input.workspaceId ? eq(forms.workspaceId, input.workspaceId) : undefined,
    input.q ? ilike(forms.name, likePattern(input.q)) : undefined,
  );
  const order = orderByForSort(SUBMITTER_FORM_SORT_COLUMNS, input.sort, forms.id, input.locale);
  // The page is chosen first, so the facts are read for its rows only.
  const page = db.$with('page').as(
    db
      .select({ formId: sql<string>`${forms.id}`.as('page_form_id') })
      .from(forms)
      .where(where)
      .orderBy(...order)
      .limit(input.limit)
      .offset(input.offset),
  );
  const permissions = permissionsByForm(input.userId, {
    workspaceId: input.workspaceId,
    formIds: db.select({ formId: page.formId }).from(page),
  }).as('caller_permission');

  return readListPage(async (tx) => {
    const items = await withSettings(
      tx
        .with(page)
        .select({
          id: forms.id,
          name: forms.name,
          workspaceId: forms.workspaceId,
          workspaceName: workspaces.name,
          publishedVersionId: publishedVersionIdOf(forms.id),
          permissions: sql<string[]>`coalesce(${permissions.permissions}, ${NO_PERMISSIONS})`,
          ...settingsColumns,
        })
        .from(forms)
        .innerJoin(page, eq(page.formId, forms.id))
        .innerJoin(workspaces, eq(workspaces.id, forms.workspaceId))
        .leftJoin(permissions, eq(permissions.formId, forms.id))
        .$dynamic(),
    ).orderBy(...order);
    const totals = await tx.select({ total: count() }).from(forms).where(where);
    return { items, total: totals[0]?.total ?? 0 };
  });
};

/** Workspaces of the forms the user holds the submitter role on or has submitted to, by name. */
export const listWorkspacesForSubmitter = (input: {
  userId: string;
  limit: number;
  locale: SortLocale;
}): Promise<{ id: string; name: string }[]> =>
  db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(
      inArray(
        workspaces.id,
        db
          .select({ workspaceId: forms.workspaceId })
          .from(forms)
          .where(and(inArray(forms.id, submitterFormIds(input.userId)), isNull(forms.deletedAt))),
      ),
    )
    .orderBy(collated(workspaces.name, input.locale), workspaces.id)
    .limit(input.limit);

/**
 * What the rules read about one form for one caller, or null when the form is not in the
 * workspace. The caller's permissions are read only when `userId` is given; the public user
 * belongs to no workspace, so it has none.
 */
export const findSubmitterFormFacts = async (input: {
  userId: string | null;
  workspaceId: string;
  formId: string;
}): Promise<FormRuleFacts | null> => {
  const permissions = input.userId
    ? permissionsByForm(input.userId, {
        workspaceId: input.workspaceId,
        formIds: [input.formId],
      }).as('caller_permission')
    : null;
  let query = withSettings(
    db
      .select({
        permissions: permissions
          ? sql<string[]>`coalesce(${permissions.permissions}, ${NO_PERMISSIONS})`
          : NO_PERMISSIONS,
        ...settingsColumns,
      })
      .from(forms)
      .$dynamic(),
  );
  if (permissions) query = query.leftJoin(permissions, eq(permissions.formId, forms.id));
  const rows = await query
    .where(and(eq(forms.id, input.formId), eq(forms.workspaceId, input.workspaceId)))
    .limit(1);
  return rows[0] ?? null;
};
