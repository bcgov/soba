'use client';

import { useCallback } from 'react';
import { openSobaFormSubmission } from '@/src/shared/api/sobaApi';
import type { WriteOutcome } from '@/src/shared/api/dataContracts';
import type { SubmissionResponse } from '@/src/types/submissions';

/**
 * Open a new submission for a form's published version. The id is minted by the caller, so a retry
 * of the same id is idempotent server-side.
 */
export function useSubmissionStarter() {
  const open = useCallback(
    async (
      token: string | undefined,
      formId: string,
      submissionId: string,
    ): Promise<WriteOutcome<SubmissionResponse>> => {
      const value = await openSobaFormSubmission(token, formId, submissionId);
      return { status: 'applied', value };
    },
    [],
  );
  return { open };
}
