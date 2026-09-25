'use client';

import { useCallback } from 'react';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { getSubmitFillBundle } from '@/src/shared/api/sobaApi';
import { useMaybeAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { classifyDataError } from '@/src/shared/api/dataError';
import type { Resource } from '@/src/shared/api/dataContracts';

type FillBundle = Awaited<ReturnType<typeof getSubmitFillBundle>>;

/**
 * The bundle for filling one submission: workflow state, its version schema, any saved answers, and
 * whether the caller may write.
 * Works signed in or anonymously; a session read, so it does not revalidate on its own.
 */
export function useSubmitFill(submissionId: string): Resource<FillBundle> {
  const { token, initializing, initStarted } = useKeycloak();
  // Wait for Keycloak to answer. Before init, "no token" is the default rather than an answer, so a
  // signed-in caller would read anonymously. Identity is in the key so signing in does not read the
  // anonymous copy.
  const ready = initStarted && !initializing && !!submissionId;

  const { data, error, isLoading, mutate } = useMaybeAuthedSWR<FillBundle>(
    ready ? ['submit-fill', submissionId, token ? 'user' : 'anonymous'] : null,
    (authToken) => getSubmitFillBundle(authToken, submissionId),
    sessionReadConfig,
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    data: data ?? null,
    isLoading: !ready || isLoading,
    error: error ? classifyDataError(error) : null,
    refresh,
  };
}
