'use client';

import { useCallback, useMemo } from 'react';
import { useSWRConfig } from 'swr';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { useCallToken } from '@/src/shared/api/callToken';
import { listReadConfig } from '@/src/shared/api/swrConfig';
import { classifyDataError } from '@/src/shared/api/dataError';
import type { ListResult, WriteOutcome } from '@/src/shared/api/dataContracts';
import { useSortLocale } from '@/src/shared/list/useSortLocale';
import type { ListQueryArgs } from '@/src/types/list';
import type { TeamGroup, TeamMember } from '@/src/types/formTeam';
import {
  addFormTeamMember,
  listFormTeam,
  listFormTeamGroups,
  removeFormTeamMember,
  setFormTeamGroups,
} from './formTeamApi';

/** Every team read of a form starts with this, so a write can re-read them all. */
export const FORM_TEAM_KEY = 'form-team';
const FORM_TEAM_GROUPS_KEY = 'form-team-groups';
const NO_GROUPS: TeamGroup[] = [];

/** One page of the form's team members, by name, with their groups on the form. */
export function useFormTeamMembers(formId: string, query: ListQueryArgs): ListResult<TeamMember> {
  const locale = useSortLocale();
  const { data, isLoading, isValidating, error, mutate } = useAuthedSWR(
    [FORM_TEAM_KEY, formId, query.offset, query.limit, query.q ?? '', locale],
    (token) => listFormTeam(token, formId, { ...query, locale }),
    listReadConfig,
  );

  const rows = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    rows,
    total: data?.page?.total,
    isLoading,
    isRefreshing: isValidating && data !== undefined,
    error: error ? classifyDataError(error) : null,
    refresh,
  };
}

/** The groups a team member can be put in: the workspace's groups. */
export function useTeamGroups(formId: string): TeamGroup[] {
  const locale = useSortLocale();
  const { data } = useAuthedSWR([FORM_TEAM_GROUPS_KEY, formId, locale], (token) =>
    listFormTeamGroups(token, formId, locale),
  );
  return data?.items ?? NO_GROUPS;
}

/**
 * Add, regroup or remove the form's team members, on this form only. Each write re-reads the
 * team. Signed in only: a session left with no token throws and sends nothing.
 */
export function useFormTeamWriter(formId: string) {
  const { mutate } = useSWRConfig();
  const { signedInToken } = useCallToken();
  const refresh = useCallback(
    () => mutate((key) => Array.isArray(key) && key[0] === FORM_TEAM_KEY && key[1] === formId),
    [mutate, formId],
  );

  const add = useCallback(
    async (userId: string, groupIds: string[]): Promise<WriteOutcome<void>> => {
      await addFormTeamMember(signedInToken(), formId, { userId, groupIds });
      await refresh();
      return { status: 'applied', value: undefined };
    },
    [formId, refresh, signedInToken],
  );

  const setGroups = useCallback(
    async (membershipId: string, groupIds: string[]): Promise<WriteOutcome<void>> => {
      await setFormTeamGroups(signedInToken(), formId, membershipId, groupIds);
      await refresh();
      return { status: 'applied', value: undefined };
    },
    [formId, refresh, signedInToken],
  );

  const remove = useCallback(
    async (membershipId: string): Promise<WriteOutcome<void>> => {
      try {
        await removeFormTeamMember(signedInToken(), formId, membershipId);
      } finally {
        // A refused remove still re-reads: the team may have changed under it.
        await refresh();
      }
      return { status: 'applied', value: undefined };
    },
    [formId, refresh, signedInToken],
  );

  return useMemo(() => ({ add, setGroups, remove }), [add, setGroups, remove]);
}
