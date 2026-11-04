import { and, asc, eq, inArray } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { ApiErrorCodes, type SortLocale, type TeamGroup, type TeamMember } from '@soba/lib';
import { db, type DbOrTx, type Tx } from '../client';
import { collated } from '../listSort';
import {
  appUsers,
  formGroupOverrideMembers,
  formGroupOverrides,
  forms,
  workspaceGroupMemberships,
  workspaceGroups,
  workspaceMemberships,
} from '../schema';
import {
  FormGroupOverrideMode,
  FormGroupOverrideStatus,
  GroupMemberKind,
  OverrideMemberEffect,
  SystemGroup,
  WorkspaceGroupMembershipStatus,
  WorkspaceGroupStatus,
  WorkspaceMembershipRole,
  WorkspaceMembershipSource,
  WorkspaceMembershipStatus,
  type OverrideMemberEffectCode,
} from '../codes';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';
import {
  FORM_TEAM_MEMBER_EXISTS,
  FORM_TEAM_MEMBER_NOT_FOUND,
  LAST_FORM_ADMIN,
} from '../../messages';
import { lockAddableUser } from './workspaceAccessRepo';

/** Workspace membership ids, by group. */
type GroupMembers = Map<string, Set<string>>;

/** A form's active override of a group. */
interface GroupOverride {
  id: string;
  mode: string;
}

/** Who is in each group on a form, and why. */
interface FormGroupState {
  /** Members in effect on the form: what permissions are resolved with (`effectiveGroups`). */
  members: GroupMembers;
  /** Members of the workspace groups themselves, whatever the form says. */
  workspace: GroupMembers;
  /** Members in effect through this form alone, not through the workspace group. */
  formOnly: GroupMembers;
  /** The form's active overrides, by group. */
  overrides: Map<string, GroupOverride>;
}

const activeGroupsOf = (executor: DbOrTx, workspaceId: string, locale: SortLocale) =>
  executor
    .select({
      id: workspaceGroups.id,
      name: workspaceGroups.name,
      systemCode: workspaceGroups.systemCode,
    })
    .from(workspaceGroups)
    .where(
      and(
        eq(workspaceGroups.workspaceId, workspaceId),
        eq(workspaceGroups.status, WorkspaceGroupStatus.active),
      ),
    )
    .orderBy(asc(collated(workspaceGroups.name, locale)), asc(workspaceGroups.id));

/** The groups a form's team members can be put in: the workspace's active groups, by name. */
export const listFormTeamGroups = async (
  workspaceId: string,
  locale: SortLocale,
): Promise<TeamGroup[]> =>
  (await activeGroupsOf(db, workspaceId, locale)).map(({ id, name }) => ({ id, name }));

const add = (members: GroupMembers, groupId: string, membershipId: string) => {
  const set = members.get(groupId) ?? new Set<string>();
  set.add(membershipId);
  members.set(groupId, set);
};

const has = (members: GroupMembers, groupId: string, membershipId: string) =>
  members.get(groupId)?.has(membershipId) ?? false;

/** Rows of (group, membership) as group members, leaving out rows without a membership. */
const byGroup = (rows: { groupId: string; membershipId: string | null }[]): GroupMembers => {
  const members: GroupMembers = new Map();
  for (const row of rows) if (row.membershipId) add(members, row.groupId, row.membershipId);
  return members;
};

/**
 * The members in effect, and those in effect through the form alone: the workspace group's, unless
 * a `replace` override drops them, less the excluded, plus the included.
 */
const combine = (
  workspace: GroupMembers,
  included: GroupMembers,
  excluded: GroupMembers,
  overrides: Map<string, GroupOverride>,
): Pick<FormGroupState, 'members' | 'formOnly'> => {
  const members: GroupMembers = new Map();
  const formOnly: GroupMembers = new Map();
  for (const [groupId, set] of workspace) {
    if (overrides.get(groupId)?.mode === FormGroupOverrideMode.replace) continue;
    for (const id of set) if (!has(excluded, groupId, id)) add(members, groupId, id);
  }
  for (const [groupId, set] of included) {
    for (const id of set) {
      add(members, groupId, id);
      if (!has(workspace, groupId, id)) add(formOnly, groupId, id);
    }
  }
  return { members, formOnly };
};

/**
 * Who is in each group on the form, by the rule permissions are resolved with (`effectiveGroups`):
 * a `replace` override makes its members the group's; an `adjust` override keeps the workspace
 * group's members, less those it excludes, plus those it includes. Active memberships in active
 * groups only.
 */
const formGroupState = async (
  executor: DbOrTx,
  workspaceId: string,
  formId: string,
): Promise<FormGroupState> => {
  const overrideRows = await executor
    .select({
      id: formGroupOverrides.id,
      groupId: formGroupOverrides.groupId,
      mode: formGroupOverrides.mode,
    })
    .from(formGroupOverrides)
    .where(
      and(
        eq(formGroupOverrides.formId, formId),
        eq(formGroupOverrides.status, FormGroupOverrideStatus.active),
      ),
    );
  const overrides = new Map(overrideRows.map((o) => [o.groupId, { id: o.id, mode: o.mode }]));

  const inherited = await executor
    .select({
      groupId: workspaceGroupMemberships.groupId,
      membershipId: workspaceGroupMemberships.workspaceMembershipId,
    })
    .from(workspaceGroupMemberships)
    .innerJoin(workspaceGroups, eq(workspaceGroups.id, workspaceGroupMemberships.groupId))
    .innerJoin(
      workspaceMemberships,
      eq(workspaceMemberships.id, workspaceGroupMemberships.workspaceMembershipId),
    )
    .where(
      and(
        eq(workspaceGroups.workspaceId, workspaceId),
        eq(workspaceGroups.status, WorkspaceGroupStatus.active),
        eq(workspaceGroupMemberships.memberKind, GroupMemberKind.user),
        eq(workspaceGroupMemberships.status, WorkspaceGroupMembershipStatus.active),
        eq(workspaceMemberships.status, WorkspaceMembershipStatus.active),
      ),
    );

  const own = await executor
    .select({
      groupId: formGroupOverrides.groupId,
      membershipId: formGroupOverrideMembers.workspaceMembershipId,
      effect: formGroupOverrideMembers.effect,
    })
    .from(formGroupOverrideMembers)
    .innerJoin(formGroupOverrides, eq(formGroupOverrides.id, formGroupOverrideMembers.overrideId))
    .innerJoin(workspaceGroups, eq(workspaceGroups.id, formGroupOverrides.groupId))
    .innerJoin(
      workspaceMemberships,
      eq(workspaceMemberships.id, formGroupOverrideMembers.workspaceMembershipId),
    )
    .where(
      and(
        eq(formGroupOverrides.formId, formId),
        eq(formGroupOverrides.status, FormGroupOverrideStatus.active),
        eq(workspaceGroups.status, WorkspaceGroupStatus.active),
        eq(formGroupOverrideMembers.memberKind, GroupMemberKind.user),
        eq(formGroupOverrideMembers.status, WorkspaceGroupMembershipStatus.active),
        eq(workspaceMemberships.status, WorkspaceMembershipStatus.active),
      ),
    );

  const workspace = byGroup(inherited);
  const included = byGroup(own.filter((row) => row.effect !== OverrideMemberEffect.exclude));
  const excluded = byGroup(own.filter((row) => row.effect === OverrideMemberEffect.exclude));
  return { ...combine(workspace, included, excluded, overrides), workspace, overrides };
};

/** Each member on the team with the groups they are in on the form, in the groups' order. */
const teamRows = async (
  executor: DbOrTx,
  workspaceId: string,
  formId: string,
  locale: SortLocale,
): Promise<TeamMember[]> => {
  const [groups, state] = await Promise.all([
    activeGroupsOf(executor, workspaceId, locale),
    formGroupState(executor, workspaceId, formId),
  ]);
  const membershipIds = [...new Set([...state.members.values()].flatMap((set) => [...set]))];
  if (!membershipIds.length) return [];
  const people = await executor
    .select({
      id: workspaceMemberships.id,
      displayLabel: appUsers.displayLabel,
      profile: appUsers.profile,
    })
    .from(workspaceMemberships)
    .innerJoin(appUsers, eq(appUsers.id, workspaceMemberships.userId))
    .where(inArray(workspaceMemberships.id, membershipIds));
  return people.map((person) => {
    const email = (person.profile as { email?: string } | null)?.email ?? '';
    const groupIds = groups.filter((g) => has(state.members, g.id, person.id)).map((g) => g.id);
    return {
      id: person.id,
      name: person.displayLabel ?? email,
      email,
      groups: groupIds,
      formOnlyGroups: groupIds.filter((id) => has(state.formOnly, id, person.id)),
    };
  });
};

const matches = (q: string, member: TeamMember) =>
  [member.name, member.email].some((field) => field.toLowerCase().includes(q.toLowerCase()));

/** One page of the form's team, by name; `q` matches anywhere in a name or an email. */
export const listFormTeam = async (input: {
  workspaceId: string;
  formId: string;
  offset: number;
  limit: number;
  q?: string;
  locale: SortLocale;
}): Promise<{ items: TeamMember[]; total: number }> => {
  const q = input.q?.trim();
  const collator = new Intl.Collator(input.locale, { sensitivity: 'base' });
  const found = (await teamRows(db, input.workspaceId, input.formId, input.locale))
    .filter((member) => !q || matches(q, member))
    .sort((a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id));
  return { items: found.slice(input.offset, input.offset + input.limit), total: found.length };
};

/** One member of the form's team; null when they are in no group on it. */
export const getFormTeamMember = async (
  workspaceId: string,
  formId: string,
  membershipId: string,
  locale: SortLocale,
): Promise<TeamMember | null> =>
  (await teamRows(db, workspaceId, formId, locale)).find((m) => m.id === membershipId) ?? null;

/** Locks the live form, so two team changes on it run one after the other. */
const lockForm = async (tx: Tx, workspaceId: string, formId: string): Promise<void> => {
  const rows = await tx
    .select({ id: forms.id })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.workspaceId, workspaceId)))
    .for('no key update');
  if (!rows[0]) throw new NotFoundError('Form not found');
};

interface Stamp {
  workspaceId: string;
  formId: string;
  displayLabel: string | null;
}

/** The form's active override of the group; a group without one starts an `adjust` override. */
const ensureOverride = async (
  tx: Tx,
  stamp: Stamp,
  groupId: string,
  existing: GroupOverride | undefined,
): Promise<GroupOverride> => {
  if (existing) return existing;
  const override = { id: uuidv7(), mode: FormGroupOverrideMode.adjust };
  await tx.insert(formGroupOverrides).values({
    id: override.id,
    workspaceId: stamp.workspaceId,
    formId: stamp.formId,
    groupId,
    mode: override.mode,
    status: FormGroupOverrideStatus.active,
    createdBy: stamp.displayLabel,
    updatedBy: stamp.displayLabel,
  });
  return override;
};

/**
 * Sets the membership's row in the override: active with `effect`, or, with no effect, inactive.
 * The row is unique whatever its status, so it is updated in place when there is one.
 */
const setOverrideMember = async (
  tx: Tx,
  stamp: Stamp,
  overrideId: string,
  membershipId: string,
  effect: OverrideMemberEffectCode | null,
): Promise<void> => {
  const [row] = await tx
    .select({ id: formGroupOverrideMembers.id })
    .from(formGroupOverrideMembers)
    .where(
      and(
        eq(formGroupOverrideMembers.overrideId, overrideId),
        eq(formGroupOverrideMembers.memberKind, GroupMemberKind.user),
        eq(formGroupOverrideMembers.workspaceMembershipId, membershipId),
      ),
    )
    .limit(1);
  const status = effect
    ? WorkspaceGroupMembershipStatus.active
    : WorkspaceGroupMembershipStatus.inactive;
  if (row) {
    await tx
      .update(formGroupOverrideMembers)
      .set({
        status,
        ...(effect ? { effect } : {}),
        updatedBy: stamp.displayLabel,
        updatedAt: new Date(),
      })
      .where(eq(formGroupOverrideMembers.id, row.id));
  } else if (effect) {
    await tx.insert(formGroupOverrideMembers).values({
      id: uuidv7(),
      workspaceId: stamp.workspaceId,
      overrideId,
      memberKind: GroupMemberKind.user,
      workspaceMembershipId: membershipId,
      effect,
      status,
      createdBy: stamp.displayLabel,
      updatedBy: stamp.displayLabel,
    });
  }
};

/**
 * Puts the membership in or out of one group on this form. Under a `replace` override that is its
 * row there. Otherwise the workspace group still decides, and the form records only the difference:
 * an include for someone the workspace group does not have, an exclude for someone it does.
 */
const setFormGroup = async (
  tx: Tx,
  stamp: Stamp,
  state: FormGroupState,
  groupId: string,
  membershipId: string,
  wanted: boolean,
): Promise<void> => {
  const existing = state.overrides.get(groupId);
  if (existing?.mode === FormGroupOverrideMode.replace) {
    await setOverrideMember(
      tx,
      stamp,
      existing.id,
      membershipId,
      wanted ? OverrideMemberEffect.include : null,
    );
    return;
  }
  const inWorkspaceGroup = has(state.workspace, groupId, membershipId);
  let effect: OverrideMemberEffectCode | null = null;
  if (wanted && !inWorkspaceGroup) effect = OverrideMemberEffect.include;
  if (!wanted && inWorkspaceGroup) effect = OverrideMemberEffect.exclude;
  if (!effect && !existing) return;
  const override = await ensureOverride(tx, stamp, groupId, existing);
  await setOverrideMember(tx, stamp, override.id, membershipId, effect);
};

/**
 * Makes `groupIds` the membership's groups on this form, changing only the groups that differ.
 * Refuses to leave the form's Form administrators empty.
 */
const applyFormGroups = async (
  tx: Tx,
  stamp: Stamp,
  membershipId: string,
  groupIds: string[],
): Promise<void> => {
  const groups = await activeGroupsOf(tx, stamp.workspaceId, 'en');
  const known = new Set(groups.map((g) => g.id));
  const unknown = groupIds.filter((id) => !known.has(id));
  if (unknown.length) throw new ValidationError(`Unknown group id(s): ${unknown.join(', ')}`);

  const wanted = new Set(groupIds);
  const before = await formGroupState(tx, stamp.workspaceId, stamp.formId);
  const changed = groups.filter(
    (group) => wanted.has(group.id) !== has(before.members, group.id, membershipId),
  );
  // One statement at a time: a transaction runs on a single connection.
  await changed.reduce(async (previous, group) => {
    await previous;
    await setFormGroup(tx, stamp, before, group.id, membershipId, wanted.has(group.id));
  }, Promise.resolve());

  const formAdmins = groups.find((g) => g.systemCode === SystemGroup.form_admins);
  if (
    formAdmins &&
    has(before.members, formAdmins.id, membershipId) &&
    !wanted.has(formAdmins.id)
  ) {
    const after = await formGroupState(tx, stamp.workspaceId, stamp.formId);
    if (!after.members.get(formAdmins.id)?.size) {
      throw new ConflictError(LAST_FORM_ADMIN, ApiErrorCodes.last_form_admin);
    }
  }
};

/** The membership's active groups on the form; empty when it is not on the team. */
const groupsOnForm = (members: GroupMembers, membershipId: string): string[] =>
  [...members.entries()].filter(([, set]) => set.has(membershipId)).map(([groupId]) => groupId);

/**
 * Puts the user on the form's team in `groupIds`, on this form only. Someone outside the workspace
 * joins it as a viewer, with no workspace groups, so they gain nothing on its other forms. Refuses
 * someone already on the team. Returns their membership id.
 */
export const addFormTeamMember = (args: {
  workspaceId: string;
  formId: string;
  userId: string;
  groupIds: string[];
  actorId: string;
  displayLabel: string | null;
}): Promise<string> =>
  db.transaction(async (tx) => {
    await lockForm(tx, args.workspaceId, args.formId);
    await lockAddableUser(tx, args.userId);
    const [membership] = await tx
      .select({ id: workspaceMemberships.id, status: workspaceMemberships.status })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, args.workspaceId),
          eq(workspaceMemberships.userId, args.userId),
        ),
      )
      .for('update');

    const now = new Date();
    const grant = {
      role: WorkspaceMembershipRole.viewer,
      status: WorkspaceMembershipStatus.active,
      invitedByUserId: args.actorId,
      invitedAt: now,
      acceptedAt: now,
      updatedBy: args.displayLabel,
      updatedAt: now,
    };
    let membershipId: string;
    if (membership?.status === WorkspaceMembershipStatus.active) {
      membershipId = membership.id;
      const current = await formGroupState(tx, args.workspaceId, args.formId);
      if (groupsOnForm(current.members, membershipId).length) {
        throw new ConflictError(FORM_TEAM_MEMBER_EXISTS, ApiErrorCodes.team_member_exists);
      }
    } else if (membership) {
      membershipId = membership.id;
      await tx
        .update(workspaceMemberships)
        .set(grant)
        .where(eq(workspaceMemberships.id, membershipId));
    } else {
      membershipId = uuidv7();
      await tx.insert(workspaceMemberships).values({
        id: membershipId,
        workspaceId: args.workspaceId,
        userId: args.userId,
        source: WorkspaceMembershipSource.user_created,
        createdBy: args.displayLabel,
        ...grant,
      });
    }

    await applyFormGroups(tx, args, membershipId, args.groupIds);
    return membershipId;
  });

/**
 * Replaces the member's groups on this form; an empty list takes them off the team. Not found when
 * they are not on it.
 */
export const setFormTeamGroups = (args: {
  workspaceId: string;
  formId: string;
  membershipId: string;
  groupIds: string[];
  displayLabel: string | null;
}): Promise<void> =>
  db.transaction(async (tx) => {
    await lockForm(tx, args.workspaceId, args.formId);
    const current = await formGroupState(tx, args.workspaceId, args.formId);
    if (!groupsOnForm(current.members, args.membershipId).length) {
      throw new NotFoundError(FORM_TEAM_MEMBER_NOT_FOUND);
    }
    await applyFormGroups(tx, args, args.membershipId, args.groupIds);
  });
