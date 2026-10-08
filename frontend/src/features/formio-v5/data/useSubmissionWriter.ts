'use client';

import { useCallback, useRef } from 'react';
import { v7 as uuidv7 } from 'uuid';
import {
  getSubmitFillBundle,
  saveSobaFormSubmission,
  submitSobaFormSubmission,
} from '@/src/shared/api/sobaApi';
import type { WriteOutcome } from '@/src/shared/api/dataContracts';
import type { SubmitFillBundle } from '@/src/types/forms';
import type { SubmissionWriteResponse } from '@/src/types/submissions';

type WriteKind = 'save' | 'submit';

/**
 * The writes of one fill session. Mints a revision id per (write, answers) so a write retried after
 * a failure replays rather than forks, bases each write on the revision the caller passes, and maps a
 * pending revision to a held outcome carrying its reason (`conflict`, or `closed` for an
 * already-submitted record).
 */
export function useSubmissionWriter(submissionId: string) {
  // Reused while the kind of write and the answers are unchanged, so a retried write replays.
  const pendingRevisionRef = useRef<{ revisionId: string; key: string } | null>(null);

  const revisionIdFor = useCallback((kind: WriteKind, data: Record<string, unknown>) => {
    const key = `${kind}:${JSON.stringify(data)}`;
    if (pendingRevisionRef.current?.key !== key) {
      pendingRevisionRef.current = { revisionId: uuidv7(), key };
    }
    return pendingRevisionRef.current.revisionId;
  }, []);

  // A write that got a response is never retried, so the next one mints a fresh id; reusing it would
  // replay the recorded result.
  const toOutcome = useCallback(
    (value: SubmissionWriteResponse): WriteOutcome<SubmissionWriteResponse> => {
      pendingRevisionRef.current = null;
      if (value.revision.status !== 'pending') {
        return { status: 'applied', value };
      }
      return { status: 'held', reason: value.revision.reason };
    },
    [],
  );

  const save = useCallback(
    async (
      token: string | undefined,
      data: Record<string, unknown>,
      baseRevisionId: string,
    ): Promise<WriteOutcome<SubmissionWriteResponse>> => {
      const revisionId = revisionIdFor('save', data);
      const value = await saveSobaFormSubmission(token, submissionId, {
        data,
        revisionId,
        baseRevisionId,
      });
      const outcome = toOutcome(value);
      // A replayed save reports where it first landed; the record may have been submitted since.
      if (outcome.status === 'applied' && value.workflowState === 'submitted') {
        return { status: 'held', reason: 'closed' };
      }
      return outcome;
    },
    [submissionId, revisionIdFor, toOutcome],
  );

  const submit = useCallback(
    async (
      token: string | undefined,
      data: Record<string, unknown>,
      baseRevisionId: string | null,
    ): Promise<WriteOutcome<SubmissionWriteResponse>> => {
      const revisionIds = baseRevisionId
        ? { revisionId: revisionIdFor('submit', data), baseRevisionId }
        : {};
      const value = await submitSobaFormSubmission(token, submissionId, { data, ...revisionIds });
      return toOutcome(value);
    },
    [submissionId, revisionIdFor, toOutcome],
  );

  // Re-read the head after a held write, so the caller can write over it or, if the record is now
  // submitted, leave for the confirmation. Null when the re-read fails.
  const reloadHead = useCallback(
    async (token: string | undefined): Promise<SubmitFillBundle | null> => {
      try {
        return await getSubmitFillBundle(token, submissionId);
      } catch {
        return null;
      }
    },
    [submissionId],
  );

  return { save, submit, reloadHead };
}
