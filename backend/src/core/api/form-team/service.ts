import type { SortLocale, TeamMember, TeamCandidate } from '@soba/lib';
import { db } from '../../db/client';
import { GroupMemberKind, Roles } from '../../db/codes';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import {
  findActiveTeamMembership,
  ensureTeamMembership,
  lockFormTeam,
  listTeamGroups,
  listFormTeamPeople,
  readTeamGroups,
  readTeamPeople,
  writeTeamGroups,
  type TeamGroupState,
} from '../../db/repos/formTeamRepo';
import { profileHelpers, type StoredProfile } from '../../auth/jwtClaims';
import type { AddFormTeamMemberInput, ListFormTeamQuery } from './schema';

export interface FormTeamContext {
  workspaceId: string;
  formId: string;
  actorDisplayLabel: string | null;
  permissions: ReadonlySet<string>;
}

/** Project effective user memberships; non-user group members remain intact in the repository. */
export function teamMembers(
  groups: TeamGroupState[],
  people: Awaited<ReturnType<typeof readTeamPeople>>,
): TeamMember[] {
  return people.flatMap((person) => {
    const assigned = groups.filter((group) =>
      group.members.some(
        (member) =>
          member.kind === GroupMemberKind.user &&
          member.workspaceMembershipId === person.membershipId,
      ),
    );
    if (!assigned.length) return [];
    const profile = person.profile as StoredProfile | null;
    return [
      {
        id: person.userId,
        name: profileHelpers.getDisplayName(profile) ?? person.displayLabel ?? person.userId,
        email: profileHelpers.getEmail(profile) ?? '',
        groups: assigned.map((group) => group.id),
      },
    ];
  });
}

/** Changes one person's effective groups while preserving all other users and identity grants. */
export function changeTeamGroups(
  groups: TeamGroupState[],
  membershipId: string,
  selected: string[],
  permissions: ReadonlySet<string>,
  activeMembershipIds: Set<string>,
): TeamGroupState[] {
  const selectedIds = new Set(selected);
  if (selected.some((id) => !groups.some((group) => group.id === id)))
    throw new ValidationError('Group is not active in this workspace');
  const changed = groups.filter((group) => {
    const current = group.members.some(
      (member) =>
        member.kind === GroupMemberKind.user && member.workspaceMembershipId === membershipId,
    );
    return current !== selectedIds.has(group.id);
  });
  if (!permissions.has('*') && changed.some((group) => group.roles.includes(Roles.form_admin))) {
    throw new ForbiddenError('Only form administrators may change form administrator membership');
  }
  const next = groups.map((group) =>
    changed.includes(group)
      ? {
          ...group,
          members: [
            ...group.members.filter(
              (member) =>
                member.kind !== GroupMemberKind.user ||
                member.workspaceMembershipId !== membershipId,
            ),
            ...(selectedIds.has(group.id)
              ? [{ kind: GroupMemberKind.user, workspaceMembershipId: membershipId }]
              : []),
          ],
        }
      : group,
  );
  const hasAdmin = (items: TeamGroupState[]) =>
    items.some(
      (group) =>
        group.roles.includes(Roles.form_admin) &&
        group.members.some(
          (member) =>
            member.kind === GroupMemberKind.user &&
            activeMembershipIds.has(member.workspaceMembershipId),
        ),
    );
  if (hasAdmin(groups) && !hasAdmin(next))
    throw new ConflictError('Form administrators must keep at least one active member');
  return next.filter((group, index) => group !== groups[index]);
}

type TeamListQuery = Pick<ListFormTeamQuery, 'q' | 'offset' | 'limit' | 'sort'>;

export const formTeamService = {
  async list(ctx: FormTeamContext, query: TeamListQuery, locale: SortLocale) {
    const result = await listFormTeamPeople({
      ...query,
      workspaceId: ctx.workspaceId,
      formId: ctx.formId,
      locale,
      candidates: false,
    });
    const items: TeamMember[] = result.items.map(({ id, name, email, groups }) => ({
      id,
      name,
      email,
      groups,
    }));
    return { items, page: { offset: query.offset, limit: query.limit, total: result.total } };
  },

  async candidates(ctx: FormTeamContext, query: TeamListQuery, locale: SortLocale) {
    const result = await listFormTeamPeople({
      ...query,
      workspaceId: ctx.workspaceId,
      formId: ctx.formId,
      locale,
      candidates: true,
    });
    const items: TeamCandidate[] = result.items.map(({ id, membershipId, name, email }) => ({
      id,
      membershipId,
      name,
      email,
    }));
    return { items, page: { offset: query.offset, limit: query.limit, total: result.total } };
  },

  async groups(ctx: FormTeamContext, locale: SortLocale) {
    const groups = await listTeamGroups(ctx.workspaceId);
    return {
      items: groups
        .map(({ id, name }) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    };
  },

  async add(ctx: FormTeamContext, input: AddFormTeamMemberInput) {
    return db.transaction(async (tx) => {
      await lockFormTeam(ctx.workspaceId, ctx.formId, tx);
      const target = input.userId
        ? await ensureTeamMembership(ctx.workspaceId, input.userId, ctx.actorDisplayLabel, tx)
        : await findActiveTeamMembership(ctx.workspaceId, input.membershipId!, tx);
      if (!target)
        throw new ValidationError('Membership is not an active member of this workspace');
      const { userId, membershipId } = target;
      const groups = await readTeamGroups(ctx.workspaceId, ctx.formId, tx);
      const people = await readTeamPeople(ctx.workspaceId, tx);
      if (teamMembers(groups, people).some((member) => member.id === userId))
        throw new ConflictError('User is already on the form team');
      const changed = changeTeamGroups(
        groups,
        membershipId,
        input.groups,
        ctx.permissions,
        new Set(people.map((member) => member.membershipId)),
      );
      await writeTeamGroups(ctx.workspaceId, ctx.formId, changed, ctx.actorDisplayLabel, tx);
      const next = groups.map((group) => changed.find((item) => item.id === group.id) ?? group);
      return teamMembers(next, people).find((member) => member.id === userId)!;
    });
  },

  async setGroups(ctx: FormTeamContext, userId: string, selected: string[]) {
    return db.transaction(async (tx) => {
      await lockFormTeam(ctx.workspaceId, ctx.formId, tx);
      const groups = await readTeamGroups(ctx.workspaceId, ctx.formId, tx);
      const people = await readTeamPeople(ctx.workspaceId, tx);
      const person = people.find((member) => member.userId === userId);
      if (!person || !teamMembers(groups, people).some((member) => member.id === userId))
        throw new NotFoundError('Form team member not found');
      const changed = changeTeamGroups(
        groups,
        person.membershipId,
        selected,
        ctx.permissions,
        new Set(people.map((member) => member.membershipId)),
      );
      await writeTeamGroups(ctx.workspaceId, ctx.formId, changed, ctx.actorDisplayLabel, tx);
      const next = groups.map((group) => changed.find((item) => item.id === group.id) ?? group);
      return teamMembers(next, people).find((member) => member.id === userId);
    });
  },
};
