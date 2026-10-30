'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { ApiErrorCodes } from '@soba/lib';
import { updateSobaSubmissionData } from '@/src/shared/api/sobaApi';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { useUnsavedId } from '@/src/shared/hooks/useUnsavedId';
import { hasPermission } from '@/src/shared/util/permissions';
import { Permissions } from '@/src/types/permissions';
import { designSubmissionKey } from './useDesignSubmission';
import { submissionReviewKey } from './useSubmissionReview';
import { useDesignFormRead } from './useForm';

const isDataChanged = (error: unknown) =>
  error instanceof ApiError && error.code === ApiErrorCodes.data_changed;

/**
 * Staff changes to a submitted submission's answers. `canEdit` says whether the caller holds
 * submission_update on the form; false until the form's permissions are known. A save re-reads the
 * submission and its review, so the answers and the edit history show the change.
 */
export function useSubmissionDataEditor(submissionId: string, formId: string) {
  const { mutate } = useSWRConfig();
  const { data: form } = useDesignFormRead(formId);
  const canEdit = hasPermission(form?.permissions, Permissions.submission_update) === true;
  const unsaved = useUnsavedId();

  const reread = useCallback(
    () =>
      Promise.all([
        mutate(designSubmissionKey(submissionId)),
        mutate(submissionReviewKey(submissionId)),
      ]),
    [mutate, submissionId],
  );

  const save = useCallback(
    async (token: string, data: Record<string, unknown>, baseRevisionId: string) => {
      // The same answers on the same base are the same write, so a retry reuses its id.
      const revisionId = unsaved.idFor(`${baseRevisionId}:${JSON.stringify(data)}`);
      try {
        await updateSobaSubmissionData(token, submissionId, { data, revisionId, baseRevisionId });
        unsaved.saved();
        await reread();
      } catch (error) {
        // Someone changed the answers first: show theirs, so the editor starts again from them.
        if (isDataChanged(error)) await reread();
        throw error;
      }
    },
    [submissionId, unsaved, reread],
  );

  return { canEdit, save };
}
