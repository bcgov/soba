'use client';

import { useCallback } from 'react';
import { openSobaFormSubmission } from '@/src/shared/api/sobaApi';
import { useCallToken } from '@/src/shared/api/callToken';
import type { WriteOutcome } from '@/src/shared/api/dataContracts';
import type { SubmissionResponse } from '@/src/types/submissions';

/**
 * Open a new submission for a form's published version, as the session is when called. The id is
 * minted by the caller, so a retry of the same id is idempotent server-side.
 */
export function useSubmissionStarter() {
  const { isSignedIn, tokenFor } = useCallToken();
  const open = useCallback(
    async (formId: string, submissionId: string): Promise<WriteOutcome<SubmissionResponse>> => {
      const value = await openSobaFormSubmission(tokenFor(isSignedIn()), formId, submissionId);
      return { status: 'applied', value };
    },
    [isSignedIn, tokenFor],
  );
  return { open };
}
