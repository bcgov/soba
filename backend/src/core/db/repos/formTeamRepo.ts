import { v7 as uuidv7 } from 'uuid';
import { and, count, eq, exists, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { db, type DbOrTx } from '../client';
import { readListPage } from '../listRead';
import { likePattern, orderByForSort, type SortColumns } from '../listSort';
import { effectiveGroups } from './formAccessRepo';
import type { SortLocale, SortToken } from '@soba/lib';
import {
  appUsers,
  identityProviders,
  userIdentities,
  forms,
  formGroupOverrides,
  formGroupOverrideMembers,
  workspaceGroups,
  workspaceGroupMemberships,
  workspaceGroupRoles,
  workspaceMemberships,
} from '../schema';
import { NotFoundError } from '../../errors';
import { type OverrideMemberInput, replaceOverrideMembers } from './formGroupOverrideRepo';
import {
  FormGroupOverrideStatus,
  GroupMemberKind,
  WorkspaceGroupMembershipStatus,
  WorkspaceGroupRoleStatus,
  WorkspaceGroupStatus,
  WorkspaceMembershipStatus,
} from '../codes';

export interface TeamGroupState {
  id: string;
  name: string;
  roles: string[];
  members: OverrideMemberInput[];
}

/** Form-wide lock serializes team mutations before any inherited membership is copied. */
export async function lockFormTeam(workspaceId: string, formId: string, tx: DbOrTx) {
  const [form] = await tx
    .select({ id: forms.id })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.workspaceId, workspaceId), isNull(forms.deletedAt)))
    .for('update');
  if (!form) throw new NotFoundError('Form not found');
}

function memberRef(row: {
  memberKind: string;
  workspaceMembershipId: string | null;
  identityProviderCode: string | null;
  idpGroupCode: string | null;
}): OverrideMemberInput[] {
  if (row.memberKind === GroupMemberKind.user && row.workspaceMembershipId)
    return [{ kind: GroupMemberKind.user, workspaceMembershipId: row.workspaceMembershipId }];
  if (row.memberKind === GroupMemberKind.idp && row.identityProviderCode)
    return [{ kind: GroupMemberKind.idp, identityProviderCode: row.identityProviderCode }];
  if (row.memberKind === GroupMemberKind.idp_group && row.idpGroupCode)
    return [{ kind: GroupMemberKind.idp_group, idpGroupCode: row.idpGroupCode }];
  return [];
}

/** Active workspace groups available to a form team. Memberships are not needed by the picker. */
export function listTeamGroups(workspaceId: string, ex: DbOrTx = db) {
  return ex
    .select({ id: workspaceGroups.id, name: workspaceGroups.name })
    .from(workspaceGroups)
    .where(
      and(
        eq(workspaceGroups.workspaceId, workspaceId),
        eq(workspaceGroups.status, WorkspaceGroupStatus.active),
      ),
    );
}

/** Keep every member kind when materializing an inherited group as a form override. */
export async function readTeamGroups(
  workspaceId: string,
  formId: string,
  ex: DbOrTx = db,
): Promise<TeamGroupState[]> {
  const groups = await listTeamGroups(workspaceId, ex);
  if (!groups.length) return [];
  const ids = groups.map((group) => group.id);
  const roles = await ex
    .select()
    .from(workspaceGroupRoles)
    .where(
      and(
        inArray(workspaceGroupRoles.groupId, ids),
        eq(workspaceGroupRoles.status, WorkspaceGroupRoleStatus.active),
      ),
    );
  const inherited = await ex
    .select()
    .from(workspaceGroupMemberships)
    .where(
      and(
        inArray(workspaceGroupMemberships.groupId, ids),
        eq(workspaceGroupMemberships.status, WorkspaceGroupMembershipStatus.active),
      ),
    );
  const overrides = await ex
    .select()
    .from(formGroupOverrides)
    .where(
      and(
        eq(formGroupOverrides.formId, formId),
        eq(formGroupOverrides.workspaceId, workspaceId),
        eq(formGroupOverrides.status, FormGroupOverrideStatus.active),
      ),
    );
  const overrideIds = overrides.map((override) => override.id);
  const explicit = overrideIds.length
    ? await ex
        .select()
        .from(formGroupOverrideMembers)
        .where(
          and(
            inArray(formGroupOverrideMembers.overrideId, overrideIds),
            eq(formGroupOverrideMembers.status, WorkspaceGroupMembershipStatus.active),
          ),
        )
    : [];
  return groups.map((group) => {
    const override = overrides.find((item) => item.groupId === group.id);
    const rows = override
      ? explicit.filter((item) => item.overrideId === override.id)
      : inherited.filter((item) => item.groupId === group.id);
    return {
      ...group,
      roles: roles.filter((role) => role.groupId === group.id).map((role) => role.roleCode),
      members: rows.flatMap(memberRef),
    };
  });
}

export async function readTeamPeople(workspaceId: string, ex: DbOrTx = db) {
  return ex
    .select({
      membershipId: workspaceMemberships.id,
      userId: appUsers.id,
      displayLabel: appUsers.displayLabel,
      profile: appUsers.profile,
    })
    .from(workspaceMemberships)
    .innerJoin(appUsers, eq(appUsers.id, workspaceMemberships.userId))
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.status, WorkspaceMembershipStatus.active),
        eq(appUsers.status, 'active'),
      ),
    );
}

/** Lock the existing membership and account so they cannot become inactive during a team write. */
export async function findActiveTeamMembership(
  workspaceId: string,
  membershipId: string,
  tx: DbOrTx,
) {
  const [member] = await tx
    .select({ membershipId: workspaceMemberships.id, userId: workspaceMemberships.userId })
    .from(workspaceMemberships)
    .innerJoin(appUsers, eq(appUsers.id, workspaceMemberships.userId))
    .where(
      and(
        eq(workspaceMemberships.id, membershipId),
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.status, WorkspaceMembershipStatus.active),
        eq(appUsers.status, 'active'),
      ),
    )
    .for('update');
  return member ?? null;
}

/** Create only a basic workspace membership; existing inactive memberships stay inactive. */
export async function ensureTeamMembership(
  workspaceId: string,
  userId: string,
  displayLabel: string | null,
  tx: DbOrTx,
) {
  const [user] = await tx
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(and(eq(appUsers.id, userId), eq(appUsers.status, 'active')))
    .for('update');
  if (!user) return null;
  await tx
    .insert(workspaceMemberships)
    .values({
      id: uuidv7(),
      workspaceId,
      userId,
      role: 'member',
      status: 'active',
      source: 'user_created',
      acceptedAt: new Date(),
      createdBy: displayLabel,
      updatedBy: displayLabel,
    })
    .onConflictDoNothing();
  const [membership] = await tx
    .select({ membershipId: workspaceMemberships.id, userId: workspaceMemberships.userId })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.status, WorkspaceMembershipStatus.active),
      ),
    )
    .for('update');
  return membership ?? null;
}

export async function writeTeamGroups(
  workspaceId: string,
  formId: string,
  groups: TeamGroupState[],
  displayLabel: string | null,
  tx: DbOrTx,
) {
  // Nested transactions use savepoints on this connection and must run in sequence.
  for (const group of groups) {
    // eslint-disable-next-line no-await-in-loop
    await replaceOverrideMembers({
      workspaceId,
      formId,
      groupId: group.id,
      members: group.members,
      displayLabel,
      executor: tx,
    });
  }
}

export const FORM_TEAM_SORT_FIELDS = ['name', 'email'] as const;
type FormTeamSortField = (typeof FORM_TEAM_SORT_FIELDS)[number];
export type FormTeamListSort = SortToken<FormTeamSortField>;

export interface FormTeamListInput {
  workspaceId: string;
  formId: string;
  offset: number;
  limit: number;
  sort: FormTeamListSort;
  q?: string;
  locale: SortLocale;
  candidates: boolean;
}

/** Page and count use the same snapshot and the authorization resolver's effective groups. */
export function listFormTeamPeople(input: FormTeamListInput) {
  const name = sql<string>`coalesce(${appUsers.profile}->>'displayName', ${appUsers.displayLabel}, ${appUsers.id}::text)`;
  const email = sql<string>`coalesce(${appUsers.profile}->>'email', '')`;
  const effective = effectiveGroups(appUsers.id, {
    workspaceId: input.workspaceId,
    formIds: [input.formId],
  });
  const groupIds = sql<string[]>`array(
    select distinct team_group.effective_group_id
    from (${effective}) as team_group
    order by team_group.effective_group_id
  )`;
  const columns: SortColumns<FormTeamSortField> = {
    name: { column: name, linguistic: true },
    email: { column: email, linguistic: true },
  };
  const where = and(
    // Internal accounts (system/public) cannot sign in and are not team candidates.
    input.candidates
      ? exists(
          db
            .select({ id: userIdentities.id })
            .from(userIdentities)
            .innerJoin(
              identityProviders,
              eq(identityProviders.code, userIdentities.identityProviderCode),
            )
            .where(
              and(
                eq(userIdentities.userId, appUsers.id),
                eq(identityProviders.isActive, true),
                eq(identityProviders.isLoginProvider, true),
              ),
            ),
        )
      : undefined,
    input.candidates
      ? undefined
      : eq(workspaceMemberships.status, WorkspaceMembershipStatus.active),
    eq(appUsers.status, 'active'),
    input.candidates ? sql`cardinality(${groupIds}) = 0` : sql`cardinality(${groupIds}) > 0`,
    input.q ? or(ilike(name, likePattern(input.q)), ilike(email, likePattern(input.q))) : undefined,
  );
  return readListPage(async (tx) => {
    const items = await tx
      .select({
        id: appUsers.id,
        membershipId: workspaceMemberships.id,
        name,
        email,
        groups: groupIds,
      })
      .from(appUsers)
      .leftJoin(
        workspaceMemberships,
        and(
          eq(appUsers.id, workspaceMemberships.userId),
          eq(workspaceMemberships.workspaceId, input.workspaceId),
        ),
      )
      .where(where)
      .orderBy(...orderByForSort(columns, input.sort, appUsers.id, input.locale))
      .offset(input.offset)
      .limit(input.limit);
    const [totals] = await tx
      .select({ total: count() })
      .from(appUsers)
      .leftJoin(
        workspaceMemberships,
        and(
          eq(appUsers.id, workspaceMemberships.userId),
          eq(workspaceMemberships.workspaceId, input.workspaceId),
        ),
      )
      .where(where);
    return { items, total: totals.total };
  });
}
