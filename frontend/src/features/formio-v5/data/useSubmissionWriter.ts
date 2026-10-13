'use client';

import { useCallback, useRef } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { getSubmitFillBundle, submitSobaFormSubmission } from '@/src/shared/api/sobaApi';
import type { WriteOutcome } from '@/src/shared/api/dataContracts';

type SubmitResult = Awaited<ReturnType<typeof submitSobaFormSubmission>>;
type FillBundle = Awaited<ReturnType<typeof getSubmitFillBundle>>;

/**
 * The submit side of one fill session. Mints a revision id per (write, answers) so a retried submit
 * replays rather than forks, bases each submit on the head revision the bundle loaded, and maps a
 * pending revision (a conflict, or an already-submitted record) to a held outcome. On held it drops
 * the reused id so the next submit is a fresh write; the caller then reloadHead's to resync its base
 * or leave for the confirmation.
 */
export function useSubmissionWriter(submissionId: string) {
  // Reused while the kind of write and the answers are unchanged, so a retried write replays.
  const pendingRevisionRef = useRef<{ revisionId: string; key: string } | null>(null);

  const revisionIdFor = useCallback((data: Record<string, unknown>) => {
    const key = `submit:${JSON.stringify(data)}`;
    if (pendingRevisionRef.current?.key !== key) {
      pendingRevisionRef.current = { revisionId: uuidv7(), key };
    }
    return pendingRevisionRef.current.revisionId;
  }, []);

  const submit = useCallback(
    async (
      token: string | undefined,
      data: Record<string, unknown>,
      baseRevisionId: string | null,
    ): Promise<WriteOutcome<SubmitResult>> => {
      const revisionIds = baseRevisionId ? { revisionId: revisionIdFor(data), baseRevisionId } : {};
      const value = await submitSobaFormSubmission(token, submissionId, { data, ...revisionIds });
      if (value.revision.status !== 'pending') {
        return { status: 'applied', value };
      }
      // Reusing the same revision id would replay this pending write, so force a fresh one.
      pendingRevisionRef.current = null;
      return { status: 'held', reason: 'pending' };
    },
    [submissionId, revisionIdFor],
  );

  // Re-read the head after a held submit, so the caller can resync its base for a retry or, if the
  // record is now submitted, leave for the confirmation. Null when the re-read fails; the caller
  // keeps the loaded base and its notice already asked for a retry.
  const reloadHead = useCallback(
    async (token: string | undefined): Promise<FillBundle | null> => {
      try {
        return await getSubmitFillBundle(token, submissionId);
      } catch {
        return null;
      }
    },
    [submissionId],
  );

  return { submit, reloadHead };
}
