'use client';

import { useEffect } from 'react';
import { unstable_serialize, useSWRConfig } from 'swr';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { classifyDataError } from '@/src/shared/api/dataError';
import { useSortLocale } from '@/src/shared/list/useSortLocale';
import { getWorkspaceGroup } from './api';

const groupKey = (workspaceId: string, groupId: string, locale: string) =>
  ['workspace-group', workspaceId, groupId, locale] as const;

/** One group, read to seed the edit form. Null `groupId` reads nothing (the create form). */
export function useWorkspaceGroup(workspaceId: string, groupId: string | null) {
  const locale = useSortLocale();
  const { data, isLoading, error } = useAuthedSWR(
    groupId ? groupKey(workspaceId, groupId, locale) : null,
    (token) => getWorkspaceGroup(token, workspaceId, groupId as string, locale),
  );

  const { cache } = useSWRConfig();
  useEffect(() => {
    if (!groupId) return;
    return () => {
      await mutate(unstable_serialize(groupKey(workspaceId, groupId, locale)), undefined)
    };
  }, [workspaceId, groupId, locale, cache]);

  return { group: data ?? null, isLoading, error: error ? classifyDataError(error) : null };
}
