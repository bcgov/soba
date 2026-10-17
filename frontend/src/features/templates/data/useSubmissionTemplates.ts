'use client';

import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { classifyDataError } from '@/src/shared/api/dataError';
import { useMaybeAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { listSubmissionTemplates, type SubmissionTemplate } from './printApi';

const NONE: SubmissionTemplate[] = [];

/** The templates the caller may print the submission with, signed in or not. */
export function useSubmissionTemplates(submissionId: string) {
  const { token, initializing, initStarted } = useKeycloak();
  // Keycloak has to answer first, or the read goes out as anonymous.
  const ready = initStarted && !initializing && !!submissionId;

  const { data, error, isLoading } = useMaybeAuthedSWR(
    ready ? ['submission-templates', submissionId, token ? 'user' : 'anonymous'] : null,
    (authToken) => listSubmissionTemplates(authToken, submissionId),
  );

  return {
    templates: data ?? NONE,
    isLoading: !ready || isLoading,
    error: error ? classifyDataError(error) : null,
  };
}
