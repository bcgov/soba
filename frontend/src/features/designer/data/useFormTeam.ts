'use client';

import { useMemo, useSyncExternalStore } from 'react';
import type { ListResult } from '@/src/shared/api/dataContracts';
import type { ListQueryArgs } from '@/src/types/list';
import type { TeamGroup, TeamMember, UserSearchResult } from '@/src/types/formTeam';

/**
 * Sample data behind the Access tab (CCP-5928). There is no team API yet, so these hooks answer
 * from memory: every form shows the same team and changes last until the page reloads. This file
 * is the only one a real implementation has to replace.
 */
const GROUPS: TeamGroup[] = [
  { id: 'group-1', name: 'Group 1' },
  { id: 'group-2', name: 'Group 2' },
  { id: 'group-3', name: 'Group 3' },
  { id: 'group-4', name: 'Group 4' },
];

const USERS: UserSearchResult[] = [
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

const toMember = (user: UserSearchResult, groups: string[]): TeamMember => ({
  id: user.id,
  name: `${user.firstName} ${user.lastName}`,
  email: user.email,
  groups,
});

let members: TeamMember[] = [
  toMember(USERS[0], ['group-1']),
  toMember(USERS[2], ['group-1']),
  toMember(USERS[3], ['group-2']),
  toMember(USERS[4], ['group-4']),
];

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getMembers = () => members;
// Resolves once stored, as a real write would, so callers already wait and handle a failure.
const setMembers = (next: TeamMember[]) => {
  members = next;
  listeners.forEach((listener) => listener());
  return Promise.resolve();
};

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
export function useFormTeamMembers(query: ListQueryArgs): ListResult<TeamMember> {
  const all = useSyncExternalStore(subscribe, getMembers, getMembers);
  const { q = '', offset, limit } = query;
  return useMemo(() => {
    const found = all
      .filter((member) => matches(q, member.name, member.email))
      .sort((a, b) => a.name.localeCompare(b.name));
    return settled(found.slice(offset, offset + limit), found.length);
  }, [all, q, offset, limit]);
}

/** Users matching the search term who could be added. Nothing is searched until there is a term. */
export function useUserSearch(q: string): UserSearchResult[] {
  return useMemo(() => {
    if (!q.trim()) return [];
    return USERS.filter((user) => matches(q, user.firstName, user.lastName, user.email));
  }, [q]);
}

/** The groups a team member can be assigned to. */
export function useTeamGroups(): TeamGroup[] {
  return GROUPS;
}

export function useFormTeamWriter() {
  return useMemo(
    () => ({
      /** Adds the user to the team; a user already on it gets the new groups instead. */
      add: (user: UserSearchResult, groups: string[]) =>
        setMembers([...members.filter((member) => member.id !== user.id), toMember(user, groups)]),
      setGroups: (memberId: string, groups: string[]) =>
        setMembers(
          members.map((member) => (member.id === memberId ? { ...member, groups } : member)),
        ),
      remove: (memberId: string) => setMembers(members.filter((member) => member.id !== memberId)),
    }),
    [],
  );
}

/** Puts the sample team back as it started. For tests. */
const INITIAL_MEMBERS = members;
export const resetFormTeam = () => void setMembers(INITIAL_MEMBERS);
