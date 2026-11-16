import { useCallback } from 'react';
import { useCallToken } from '@/src/shared/api/callToken';
import { emailSubmitSubmissionCopy } from '@/src/shared/api/sobaApi';

/**
 * Sends a copy of a submission's confirmation to one address, as the caller: signed in, or the
 * public user. Resolves once the server has queued it; a refusal rejects with an ApiError, and a
 * signed-in session that has lost its token rejects with SessionExpiredError without sending.
 */
export function useSendEmailCopy(submissionId: string): (to: string) => Promise<void> {
  const { isSignedIn, tokenFor } = useCallToken();
  return useCallback(
    async (to: string) => emailSubmitSubmissionCopy(tokenFor(isSignedIn()), submissionId, to),
    [isSignedIn, tokenFor, submissionId],
  );
}
