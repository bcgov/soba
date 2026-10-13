'use client';

import { useCallback, useMemo } from 'react';
import { useSWRConfig } from 'swr';
import { deleteSubmitSubmission, getMySubmissions } from '@/src/shared/api/sobaApi';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { useCallToken } from '@/src/shared/api/callToken';
import { listReadConfig } from '@/src/shared/api/swrConfig';
import { classifyDataError } from '@/src/shared/api/dataError';
import type { ListResult, WriteOutcome } from '@/src/shared/api/dataContracts';
import type { ListQueryArgs } from '@/src/types/list';
import type { MySubmissionListItem, MySubmissionState } from '@/src/types/submissions';
import { useSortLocale } from '@/src/shared/list/useSortLocale';

const KEY = 'my-submissions';
const EMPTY: MySubmissionListItem[] = [];

/** One page of the caller's own draft and submitted submissions, optionally of one state. */
export function useMySubmissions(
  query: ListQueryArgs,
  workflowState: MySubmissionState | undefined,
): ListResult<MySubmissionListItem> {
  const locale = useSortLocale();
  const { data, isLoading, isValidating, error, mutate } = useAuthedSWR(
    [KEY, query.offset, query.limit, query.sort, query.q ?? '', workflowState ?? '', locale],
    (token) =>
      getMySubmissions(token, {
        offset: query.offset,
        limit: query.limit,
        sort: query.sort,
        q: query.q,
        locale,
        workflowState,
      }),
    listReadConfig,
  );

  const rows: MySubmissionListItem[] = useMemo(
    () => (Array.isArray(data?.items) ? data.items : EMPTY),
    [data],
  );
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
 * Delete one of the caller's own unsubmitted submissions, then re-read the list. Signed in only: a
 * session left with no token throws SessionExpiredError and sends nothing.
 */
export function useMySubmissionDeleter() {
  const { mutate } = useSWRConfig();
  const { signedInToken } = useCallToken();
  const remove = useCallback(
    async (submissionId: string): Promise<WriteOutcome<void>> => {
      const token = signedInToken();
      try {
        await deleteSubmitSubmission(token, submissionId);
        return { status: 'applied', value: undefined };
      } finally {
        // A refused delete still re-reads: the row may have been submitted elsewhere.
        await mutate((key) => Array.isArray(key) && key[0] === KEY);
      }
    },
    [mutate, signedInToken],
  );
  return { remove };
}
