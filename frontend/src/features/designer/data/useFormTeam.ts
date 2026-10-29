'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { useCallToken } from '@/src/shared/api/callToken';
import { classifyDataError } from '@/src/shared/api/dataError';
import { listReadConfig } from '@/src/shared/api/swrConfig';
import { useSortLocale } from '@/src/shared/list/useSortLocale';
import type { ListResult, WriteOutcome } from '@/src/shared/api/dataContracts';
import type { ListQueryArgs } from '@/src/types/list';
import type { TeamGroup, TeamMember, TeamCandidate } from '@/src/types/formTeam';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import {
  addTeamMember,
  fetchFormTeam,
  fetchTeamGroups,
  fetchTeamCandidates,
  removeTeamMember,
  setTeamMemberGroups,
} from './formTeamApi';

const EMPTY_MEMBERS: TeamMember[] = [];
const EMPTY_GROUPS: TeamGroup[] = [];
const EMPTY_CANDIDATES: TeamCandidate[] = [];

export function useFormTeamMembers(formId: string, query: ListQueryArgs): ListResult<TeamMember> {
  const locale = useSortLocale();
  const { data, isLoading, isValidating, error, mutate } = useAuthedSWR(
    ['form-team', formId, query.offset, query.limit, query.sort, query.q ?? '', locale],
    (token) => fetchFormTeam(token, formId, { ...query, locale }),
    listReadConfig,
  );
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);
  return {
    rows: data?.items ?? EMPTY_MEMBERS,
    total: data?.page.total,
    isLoading,
    isRefreshing: isValidating && !isLoading,
    error: error ? classifyDataError(error) : null,
    refresh,
  };
}

export function useTeamGroups(formId: string) {
  const locale = useSortLocale();
  const { data, isLoading, error } = useAuthedSWR(['form-team-groups', formId, locale], (token) =>
    fetchTeamGroups(token, formId, locale),
  );
  return {
    groups: data?.items ?? EMPTY_GROUPS,
    isLoading,
    error: error ? classifyDataError(error) : null,
  };
}

/** Active Soba users not already on this form. Results belong only to the current term. */
export function useFormTeamCandidates(formId: string, term: string) {
  const q = term.trim();
  const settled = useDebouncedValue(q, 300);
  const locale = useSortLocale();
  const { data, isLoading, error } = useAuthedSWR(
    ['form-team-candidates', formId, settled, locale],
    (token) => fetchTeamCandidates(token, formId, settled, locale),
  );
  const pending = q !== settled;
  return {
    members: pending || error ? EMPTY_CANDIDATES : (data?.items ?? EMPTY_CANDIDATES),
    isLoading: pending || isLoading,
    error: !pending && error ? classifyDataError(error) : null,
    truncated: (data?.page.total ?? 0) > (data?.items.length ?? 0),
  };
}

export function useFormTeamWriter(formId: string) {
  const { signedInToken } = useCallToken();
  const { mutate } = useSWRConfig();
  const refresh = useCallback(async () => {
    // Editing one's own access also changes the designer record and visible forms.
    await mutate(
      (key) =>
        Array.isArray(key) &&
        (key[0] === 'forms' ||
          ((key[0] === 'form-team' ||
            key[0] === 'form-team-candidates' ||
            key[0] === 'design-form') &&
            key[1] === formId)),
    ).catch(() => undefined);
  }, [formId, mutate]);
  const add = useCallback(
    async (member: TeamCandidate, groups: string[]): Promise<WriteOutcome<void>> => {
      if (member.membershipId) {
        await addTeamMember(signedInToken(), formId, member.membershipId, groups);
      } else {
        await addTeamMember(signedInToken(), formId, null, groups, member.id);
      }
      await refresh();
      return { status: 'applied', value: undefined };
    },
    [formId, signedInToken, refresh],
  );
  const setGroups = useCallback(
    async (userId: string, groups: string[]): Promise<WriteOutcome<void>> => {
      await setTeamMemberGroups(signedInToken(), formId, userId, groups);
      await refresh();
      return { status: 'applied', value: undefined };
    },
    [formId, signedInToken, refresh],
  );
  const remove = useCallback(
    async (userId: string): Promise<WriteOutcome<void>> => {
      await removeTeamMember(signedInToken(), formId, userId);
      await refresh();
      return { status: 'applied', value: undefined };
    },
    [formId, signedInToken, refresh],
  );
  return { add, setGroups, remove };
}
