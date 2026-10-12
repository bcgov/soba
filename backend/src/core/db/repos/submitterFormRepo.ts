import {
  and,
  count,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  sql,
  type SQL,
  type SQLWrapper,
} from 'drizzle-orm';
import { unionAll, type PgSelect } from 'drizzle-orm/pg-core';
import {
  MY_FORM_SORT_FIELDS,
  MY_SUBMISSION_STATES,
  type AudienceMode,
  type MyFormListSort,
  type SortLocale,
  type SubmitterFormFacts,
} from '@soba/lib';
import { db, type DbOrTx } from '../client';
import {
  formAudienceSettings,
  forms,
  formSubmitterSettings,
  formVersions,
  submissionParticipants,
  submissions,
  workspaceAudienceSettings,
  workspaceSubmitterSettings,
  workspaces,
} from '../schema';
import { FormVersionState, Roles, SubmissionParticipantStatus } from '../codes';
import { collated, likePattern, orderByForSort, type SortColumns } from '../listSort';
import { readListPage } from '../listRead';
import { effectiveGroups, permissionsByForm } from './formAccessRepo';

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

export interface ListSubmitterFormsInput {
  userId: string;
  offset: number;
  limit: number;
  workspaceId?: string;
  q?: string;
  sort: MyFormListSort;
  locale: SortLocale;
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

/**
 * The facts columns for the forms in `scope`, and the joins they read. Permissions are read only for
 * a user; the public user belongs to no workspace, so it has none.
 */
export const formFacts = (
  userId: string | null,
  scope: { workspaceId?: string; formIds: string[] | SQLWrapper },
) => {
  const permissions = userId ? permissionsByForm(userId, scope).as('caller_permission') : null;
  return {
    columns: {
      publishedVersionId: publishedVersionIdOf(forms.id),
      permissions: permissions
        ? sql<string[]>`coalesce(${permissions.permissions}, ${NO_PERMISSIONS})`
        : NO_PERMISSIONS,
      ...settingsColumns,
    },
    join: <T extends PgSelect>(query: T) => {
      const joined = withSettings(query);
      // A dynamic query joins in place, and every caller selects explicitly, so the type holds.
      return permissions
        ? (joined.leftJoin(
            permissions,
            eq(permissions.formId, forms.id),
          ) as unknown as typeof joined)
        : joined;
    },
  };
};

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
  const facts = formFacts(input.userId, {
    workspaceId: input.workspaceId,
    formIds: db.select({ formId: page.formId }).from(page),
  });

  return readListPage(async (tx) => {
    const items = await facts
      .join(
        tx
          .with(page)
          .select({
            id: forms.id,
            name: forms.name,
            workspaceId: forms.workspaceId,
            workspaceName: workspaces.name,
            ...facts.columns,
          })
          .from(forms)
          .innerJoin(page, eq(page.formId, forms.id))
          .innerJoin(workspaces, eq(workspaces.id, forms.workspaceId))
          .$dynamic(),
      )
      .orderBy(...order);
    const totals = await tx.select({ total: count() }).from(forms).where(where);
    return { items, total: totals[0]?.total ?? 0 };
  });
};

/** The given forms with their facts for one caller, across workspaces, in no particular order. */
export const listSubmitterForms = async (
  input: { userId: string | null; formIds: readonly string[] },
  executor: DbOrTx = db,
): Promise<SubmitterFormListRow[]> => {
  if (input.formIds.length === 0) return [];
  const formIds = [...input.formIds];
  const facts = formFacts(input.userId, { formIds });
  return facts
    .join(
      executor
        .select({
          id: forms.id,
          name: forms.name,
          workspaceId: forms.workspaceId,
          workspaceName: workspaces.name,
          ...facts.columns,
        })
        .from(forms)
        .innerJoin(workspaces, eq(workspaces.id, forms.workspaceId))
        .$dynamic(),
    )
    .where(inArray(forms.id, formIds));
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
 * workspace. A deleted form still answers; whether its submission or version is live is the
 * caller's lookup.
 */
export const findSubmitterFormFacts = async (
  input: { userId: string | null; workspaceId: string; formId: string },
  executor: DbOrTx = db,
): Promise<SubmitterFormFacts | null> => {
  const facts = formFacts(input.userId, {
    workspaceId: input.workspaceId,
    formIds: [input.formId],
  });
  const rows = await facts
    .join(executor.select(facts.columns).from(forms).$dynamic())
    .where(and(eq(forms.id, input.formId), eq(forms.workspaceId, input.workspaceId)))
    .limit(1);
  return rows[0] ?? null;
};
