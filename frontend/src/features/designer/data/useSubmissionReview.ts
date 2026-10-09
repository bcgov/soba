'use client';

import { useCallback } from 'react';
import {
  addSobaSubmissionNote,
  getSobaSubmissionReview,
  recordSobaSubmissionEdit,
  updateSobaSubmissionStatus,
} from '@/src/shared/api/sobaApi';
import type { SubmissionReview, UpdateSubmissionStatusBody } from '@/src/types/submissionReview';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { classifyDataError } from '@/src/shared/api/dataError';
import type { Resource } from '@/src/shared/api/dataContracts';

/** Staff review state of one submission: status, notes and edit history, with their writes. */
export function useSubmissionReview(submissionId: string) {
  const { data, error, isLoading, mutate } = useAuthedSWR(
    ['submission-review', submissionId],
    (token) => getSobaSubmissionReview(token, submissionId),
  );

  // Each write answers with the updated review, which replaces the cached one.
  const apply = useCallback(
    async (written: Promise<SubmissionReview>) => {
      await mutate(written, { revalidate: false });
    },
    [mutate],
  );

  const updateStatus = useCallback(
    (token: string, body: UpdateSubmissionStatusBody) =>
      apply(updateSobaSubmissionStatus(token, submissionId, body)),
    [apply, submissionId],
  );
  const addNote = useCallback(
    (token: string, text: string) => apply(addSobaSubmissionNote(token, submissionId, text)),
    [apply, submissionId],
  );
  const saveData = useCallback(
    (token: string) => apply(recordSobaSubmissionEdit(token, submissionId)),
    [apply, submissionId],
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);
  const review: Resource<SubmissionReview> = {
    data: data ?? null,
    isLoading,
    error: error ? classifyDataError(error) : null,
    refresh,
  };

  return { review, updateStatus, addNote, saveData };
}
