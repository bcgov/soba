import { useId } from 'react';
import useSWR from 'swr';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';
import { fetchFeatureAvailability } from '@/src/shared/featureFlags/featureAvailability';

/**
 * Whether submitters can email themselves a copy here, for a workspace or a form, which names its
 * workspace too in case the feature is scoped. Asked anew each time the caller mounts, as
 * usePostSubmissionAvailable is. Undefined while the check runs; false without a scope, and when the
 * check fails.
 */
export function useEmailCopyAvailable(
  scope: { workspaceId: string; formId?: string } | null,
): boolean | undefined {
  const readId = useId();
  const { data } = useSWR(
    scope
      ? ['submitter-email-copy-available', scope.workspaceId, scope.formId ?? null, readId]
      : null,
    () => fetchFeatureAvailability(FEATURE_CODES.SUBMITTER_EMAIL_COPY, scope ?? {}),
    sessionReadConfig,
  );
  return scope ? data : false;
}
