'use client';

import { useCallback, useEffect, useState } from 'react';
import { unstable_serialize, useSWRConfig } from 'swr';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { getSubmitFillBundle } from '@/src/shared/api/sobaApi';
import { useCallToken } from '@/src/shared/api/callToken';
import { useMaybeAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { classifyDataError } from '@/src/shared/api/dataError';
import type { Resource } from '@/src/shared/api/dataContracts';
import type { SubmitFillBundle } from '@/src/types/forms';

/**
 * The bundle for filling one submission: workflow state, its version schema, any saved answers, the
 * caller's role and the form's facts.
 * Works signed in or anonymously; a session read, so it does not revalidate on its own.
 */
export function useSubmitFill(submissionId: string): Resource<SubmitFillBundle> {
  const { authenticated, initializing, initStarted } = useKeycloak();
  const { tokenFor } = useCallToken();
  // Wait for Keycloak to answer. Before init, "no token" is the default rather than an answer, so a
  // signed-in caller would read anonymously.
  const ready = initStarted && !initializing && !!submissionId;

  // The first read's identity holds for the page. Identity is in the key, so a signed-in read never
  // serves an anonymous copy; once the session ends, a read fails as ended rather than going out
  // anonymously.
  const [pinned, setPinned] = useState<boolean | null>(null);
  if (ready && pinned === null) setPinned(authenticated);
  const signedIn = pinned ?? authenticated;
  const identity = signedIn ? 'user' : 'anonymous';

  const { data, error, isLoading, mutate } = useMaybeAuthedSWR<SubmitFillBundle>(
    ready ? ['submit-fill', submissionId, identity] : null,
    () => getSubmitFillBundle(tokenFor(signedIn), submissionId),
    sessionReadConfig,
  );

  // One read per visit: the cached copy predates any save made on the page, so leaving drops it. A
  // plain delete, not mutate: a mutate marks the key changed and SWR discards a fetch still in flight.
  const { cache } = useSWRConfig();
  useEffect(() => {
    if (!ready) return undefined;
    const cacheKey = unstable_serialize(['submit-fill', submissionId, identity]);
    return () => cache.delete(cacheKey);
  }, [ready, submissionId, identity, cache]);

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
