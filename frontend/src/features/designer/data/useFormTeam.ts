'use client';

import { useMemo, useSyncExternalStore } from 'react';
import type { ListResult, WriteOutcome } from '@/src/shared/api/dataContracts';
import type { ListQueryArgs } from '@/src/types/list';
import type { TeamGroup, TeamMember, UserSearchResult } from '@/src/types/formTeam';

/**
 * Sample data behind the Access tab (CCP-5928). There is no team API yet, so these hooks answer
 * from memory: each form starts with the same sample team and changes last until the page
 * reloads. The hooks take a form id and return `WriteOutcome` as the API-backed ones will, so the
 * screens should not need to change when the bodies here are replaced.
 */
const GROUPS: TeamGroup[] = [
  { id: 'group-1', name: 'Group 1' },
  { id: 'group-2', name: 'Group 2' },
  { id: 'group-3', name: 'Group 3' },
  { id: 'group-4', name: 'Group 4' },
];

type SampleUser = Omit<UserSearchResult, 'onTeam'>;

const USERS: SampleUser[] = [
  ['Orla', 'Venn'],
  ['Tobin', 'Venn'],
  ['Mirela', 'Quist'],
  ['Dax', 'Halloran'],
  ['Suri', 'Okonjo'],
  ['Pell', 'Arvidsen'],
  ['Juno', 'Tamsin'],
].map(([firstName, lastName], index) => ({
  id: `user-${index + 1}`,
  firstName,
  lastName: `${lastName} (sample)`,
  email: `${firstName}.${lastName}@example.gov.bc.ca`.toLowerCase(),
  identityProvider: 'IDIR',
}));

const toMember = (user: SampleUser, groups: string[]): TeamMember => ({
  id: user.id,
  name: `${user.firstName} ${user.lastName}`,
  email: user.email,
  groups,
});

const SAMPLE_TEAM: TeamMember[] = [
  toMember(USERS[0], ['group-1']),
  toMember(USERS[2], ['group-1']),
  toMember(USERS[3], ['group-2']),
  toMember(USERS[4], ['group-4']),
];

/** Teams by form id. A form not in the map still has the sample team. */
let teams = new Map<string, TeamMember[]>();

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const teamOf = (formId: string) => teams.get(formId) ?? SAMPLE_TEAM;
// Resolves once stored, as a real write would, so callers already wait and handle a failure.
const setTeam = (formId: string, next: TeamMember[]): Promise<WriteOutcome<void>> => {
  teams = new Map(teams).set(formId, next);
  listeners.forEach((listener) => listener());
  return Promise.resolve({ status: 'applied', value: undefined });
};
const useTeam = (formId: string) =>
  useSyncExternalStore(
    subscribe,
    () => teamOf(formId),
    () => teamOf(formId),
  );

const matches = (q: string, ...fields: string[]) =>
  fields.some((field) => field.toLowerCase().includes(q.trim().toLowerCase()));

const settled = <T>(rows: T[], total: number): ListResult<T> => ({
  rows,
  total,
  isLoading: false,
  isRefreshing: false,
  error: null,
  refresh: () => Promise.resolve(),
});

/** One page of the form's team members, by name. */
export function useFormTeamMembers(formId: string, query: ListQueryArgs): ListResult<TeamMember> {
  const team = useTeam(formId);
  const { q = '', offset, limit } = query;
  return useMemo(() => {
    const found = team
      .filter((member) => matches(q, member.name, member.email))
      .sort((a, b) => a.name.localeCompare(b.name));
    return settled(found.slice(offset, offset + limit), found.length);
  }, [team, q, offset, limit]);
}

/**
 * Users matching the search term, with the ones already on the form's team marked. Nothing is
 * searched until there is a term.
 */
export function useUserSearch(formId: string, q: string): UserSearchResult[] {
  const team = useTeam(formId);
  return useMemo(() => {
    if (!q.trim()) return [];
    return USERS.filter((user) => matches(q, user.firstName, user.lastName, user.email)).map(
      (user) => ({ ...user, onTeam: team.some((member) => member.id === user.id) }),
    );
  }, [team, q]);
}

/** The groups a team member can be assigned to. */
export function useTeamGroups(): TeamGroup[] {
  return GROUPS;
}

export function useFormTeamWriter(formId: string) {
  return useMemo(
    () => ({
      /** Refused for a user already on the team, as the API will be: their groups change by Edit. */
      add: (user: UserSearchResult, groups: string[]) => {
        const team = teamOf(formId);
        if (team.some((member) => member.id === user.id)) {
          return Promise.reject(new Error(`${user.id} is already on the team`));
        }
        return setTeam(formId, [...team, toMember(user, groups)]);
      },
      setGroups: (memberId: string, groups: string[]) =>
        setTeam(
          formId,
          teamOf(formId).map((member) => (member.id === memberId ? { ...member, groups } : member)),
        ),
      remove: (memberId: string) =>
        setTeam(
          formId,
          teamOf(formId).filter((member) => member.id !== memberId),
        ),
    }),
    [formId],
  );
}

/** Puts every form back to the sample team. For tests. */
export const resetFormTeam = () => {
  teams = new Map();
  listeners.forEach((listener) => listener());
};
