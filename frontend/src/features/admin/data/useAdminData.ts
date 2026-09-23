'use client';

import { useCallback, useEffect, useMemo } from 'react';
import {
  addSobaAdmin,
  fetchDocumentGenerationAudits,
  fetchFeatureScope,
  fetchFeatureScopes,
  fetchSobaAdmins,
  removeFeatureScope,
  removeSobaAdmin,
  upsertFeatureScope,
} from '@/src/shared/api/sobaApiAdmin';
import { unstable_serialize, useSWRConfig } from 'swr';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { listReadConfig } from '@/src/shared/api/swrConfig';
import { classifyDataError } from '@/src/shared/api/dataError';
import type { ListResult, WriteOutcome } from '@/src/shared/api/dataContracts';
import type { ListQueryArgs } from '@/src/types/list';
import type {
  DocumentGenerationAuditItem,
  FeatureScopeItem,
  SobaAdminItem,
  UpsertFeatureScopeBody,
} from '@/src/types/admin';

const scopeKey = (featureScopeId: string) => ['feature-scope', featureScopeId];

/**
 * A failed reload leaves the table showing the rows it already had, where the table's own error
 * state is not reached, so these reads report the failure to the caller. Retrying would report it
 * again for the same load.
 */
const reportOnce = (onError: (cause: unknown) => void) => ({
  shouldRetryOnError: false,
  onError,
});

export function useSobaAdmins(query: ListQueryArgs): ListResult<SobaAdminItem> {
  const { data, isLoading, isValidating, error, mutate } = useAuthedSWR(
    ['soba-admins', query.offset, query.limit, query.sort, query.q ?? ''],
    (token) => fetchSobaAdmins(token, query),
    { ...listReadConfig, shouldRetryOnError: false },
  );

  const rows: SobaAdminItem[] = useMemo(() => data?.items ?? [], [data]);
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

/**
 * The server applies the allow-list, so the total it reports is the total the table can show.
 */
export function useFeatureScopes(
  allowedFeatureCodes: string[],
  query: ListQueryArgs,
): ListResult<FeatureScopeItem> {
  const codes = useMemo(
    () => [...allowedFeatureCodes].sort((a, b) => a.localeCompare(b)).join(','),
    [allowedFeatureCodes],
  );
  const { data, isLoading, isValidating, error, mutate } = useAuthedSWR(
    allowedFeatureCodes.length > 0
      ? ['feature-scopes', codes, query.offset, query.limit, query.sort, query.q ?? '']
      : null,
    (token) => fetchFeatureScopes(token, { ...query, featureCodes: allowedFeatureCodes }),
    { ...listReadConfig, shouldRetryOnError: false },
  );

  const rows: FeatureScopeItem[] = useMemo(() => data?.items ?? [], [data]);
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

/**
 * Audits for one workspace or form. The endpoint requires one of them, so there is no read until
 * the admin has searched.
 */
export function useDocumentGenerationAudits(
  filter: { workspaceId?: string; formId?: string } | null,
  query: ListQueryArgs,
): ListResult<DocumentGenerationAuditItem> {
  const { data, isLoading, isValidating, error, mutate } = useAuthedSWR(
    filter
      ? [
          'docgen-audits',
          filter.workspaceId ?? '',
          filter.formId ?? '',
          query.offset,
          query.limit,
          query.sort,
        ]
      : null,
    (token) => fetchDocumentGenerationAudits(token, { ...query, ...filter }),
    { ...listReadConfig, shouldRetryOnError: false },
  );

  const rows: DocumentGenerationAuditItem[] = useMemo(() => data?.items ?? [], [data]);
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

export function useFeatureScope(
  featureScopeId: string | undefined,
  enabled: boolean,
  onError: (cause: unknown) => void,
) {
  const { data, isLoading, error } = useAuthedSWR(
    featureScopeId && enabled ? scopeKey(featureScopeId) : null,
    (token) => fetchFeatureScope(token, featureScopeId as string),
    reportOnce(onError),
  );

  const { cache } = useSWRConfig();
  useEffect(() => {
    if (!featureScopeId) return;
    // The record is read once to seed the form, which cannot re-seed itself. A cached copy would
    // seed the next visit from a status the save that just happened, or a toggle in the list, has
    // already moved on from, and saving there would write that stale status back. Dropping the
    // entry is what makes the next visit read the record again. `mutate(key, undefined)` reads as
    // "revalidate", not "forget", so the eviction goes through the cache itself.
    return () => {
      cache.delete(unstable_serialize(scopeKey(featureScopeId)));
    };
  }, [featureScopeId, cache]);

  return { featureScope: data ?? null, isLoading, error: error ? classifyDataError(error) : null };
}

/** Add or remove a platform administrator. */
export function useSobaAdminWriter() {
  const { mutate } = useSWRConfig();
  const refresh = useCallback(
    () => mutate((key) => Array.isArray(key) && key[0] === 'soba-admins'),
    [mutate],
  );
  const add = useCallback(
    async (token: string, userId: string): Promise<WriteOutcome<void>> => {
      await addSobaAdmin(token, userId);
      await refresh();
      return { status: 'applied', value: undefined };
    },
    [refresh],
  );
  const remove = useCallback(
    async (token: string, userId: string): Promise<WriteOutcome<void>> => {
      await removeSobaAdmin(token, userId);
      await refresh();
      return { status: 'applied', value: undefined };
    },
    [refresh],
  );
  return { add, remove };
}

/** Create, update or remove a feature scope. */
export function useFeatureScopeWriter() {
  const { mutate } = useSWRConfig();
  const refresh = useCallback(
    () => mutate((key) => Array.isArray(key) && key[0] === 'feature-scopes'),
    [mutate],
  );
  const upsert = useCallback(
    async (token: string, body: UpsertFeatureScopeBody): Promise<WriteOutcome<void>> => {
      await upsertFeatureScope(token, body);
      await refresh();
      return { status: 'applied', value: undefined };
    },
    [refresh],
  );
  const remove = useCallback(
    async (token: string, id: string): Promise<WriteOutcome<void>> => {
      await removeFeatureScope(token, id);
      await refresh();
      return { status: 'applied', value: undefined };
    },
    [refresh],
  );
  return { upsert, remove };
}
