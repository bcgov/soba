'use client';

import { useCallback, useState } from 'react';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useCallToken } from '@/src/shared/api/callToken';
import {
  getSubmitSubmission,
  getSubmitSubmissionData,
  getSubmitSubmissionSchema,
} from '@/src/shared/api/sobaApi';
import { useMaybeAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { classifyDataError } from '@/src/shared/api/dataError';
import type { Resource } from '@/src/shared/api/dataContracts';

type SubmitSubmission = Awaited<ReturnType<typeof loadSubmitSubmission>>;

async function loadSubmitSubmission(token: string | undefined, submissionId: string) {
  // Submit-mode: read through the submit APIs regardless of sign-in so participants who are not
  // workspace members can still view.
  const submission = await getSubmitSubmission(token, submissionId);
  const [schema, content] = await Promise.all([
    getSubmitSubmissionSchema(token, submissionId),
    getSubmitSubmissionData(token, submissionId),
  ]);
  return { submission, schema, content };
}

/** The confirmation read: works signed in or anonymously for a participant on the submission. */
export function useSubmitSubmission(submissionId: string): Resource<SubmitSubmission> {
  const { token, initializing, initStarted } = useKeycloak();
  const { tokenFor } = useCallToken();
  // Pinned once signed in: after the session ends a read fails as ended rather than going out
  // anonymously.
  const [signedInHere, setSignedInHere] = useState(false);
  if (token && !signedInHere) setSignedInHere(true);
  const signedIn = signedInHere || !!token;
  // Wait for Keycloak to answer before reading. Before init, "no token" is the default rather than
  // an answer. The identity is part of the key so signing in does not read the anonymous copy.
  const ready = initStarted && !initializing && !!submissionId;

  const { data, error, isLoading, mutate } = useMaybeAuthedSWR(
    ready ? ['submit-submission', submissionId, signedIn ? 'user' : 'anonymous'] : null,
    () => loadSubmitSubmission(tokenFor(signedIn), submissionId),
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    data: data ?? null,
    // No read runs until Keycloak answers; report loading so the view does not flash "not found".
    isLoading: !ready || isLoading,
    error: error ? classifyDataError(error) : null,
    refresh,
  };
}
