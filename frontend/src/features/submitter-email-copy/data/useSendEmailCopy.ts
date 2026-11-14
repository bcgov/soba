import { useCallback } from 'react';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { emailSubmitSubmissionCopy } from '@/src/shared/api/sobaApi';

/**
 * Sends a copy of a submission's confirmation to one address, as the caller: signed in, or the
 * public user. Resolves once the server has queued it; a refusal rejects with an ApiError.
 */
export function useSendEmailCopy(submissionId: string): (to: string) => Promise<void> {
  const { token } = useKeycloak();
  return useCallback(
    (to: string) => emailSubmitSubmissionCopy(token ?? undefined, submissionId, to),
    [token, submissionId],
  );
}
