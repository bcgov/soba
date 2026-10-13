'use client';

import { useCallback, useRef } from 'react';
import { v7 as uuidv7 } from 'uuid';
import {
  getSubmitFillBundle,
  saveSobaFormSubmission,
  submitSobaFormSubmission,
} from '@/src/shared/api/sobaApi';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { useCallToken } from '@/src/shared/api/callToken';
import type { WriteOutcome } from '@/src/shared/api/dataContracts';

export type WriteResult = Awaited<ReturnType<typeof submitSobaFormSubmission>>;
type FillBundle = Awaited<ReturnType<typeof getSubmitFillBundle>>;
type WriteKind = 'save' | 'submit';

/**
 * The writes of one fill session, sent as the session started: a signed-in session never writes
 * anonymously. Mints a revision id per (write, answers) and reuses it only when the last attempt got
 * no response or a server failure, so a retry replays rather than forks. Maps a pending revision to
 * a held outcome carrying its reason (`conflict`, or `closed` for an already-submitted record).
 */
export function useSubmissionWriter(submissionId: string, signedIn: boolean) {
  const { tokenFor } = useCallToken();
  const pendingRevisionRef = useRef<{ revisionId: string; key: string } | null>(null);

  const revisionIdFor = useCallback((kind: WriteKind, data: Record<string, unknown>) => {
    const key = `${kind}:${JSON.stringify(data)}`;
    if (pendingRevisionRef.current?.key !== key) {
      pendingRevisionRef.current = { revisionId: uuidv7(), key };
    }
    return pendingRevisionRef.current.revisionId;
  }, []);

  // A success or a refusal settles the id: a success must not be replayed and a refusal recorded
  // nothing. No response or a server failure keeps it, since the write may have landed and a retry
  // must replay it rather than fork.
  const send = useCallback(
    async (
      kind: WriteKind,
      data: Record<string, unknown>,
      baseRevisionId: string,
    ): Promise<WriteResult> => {
      const token = tokenFor(signedIn);
      const body = { data, revisionId: revisionIdFor(kind, data), baseRevisionId };
      try {
        const write = kind === 'save' ? saveSobaFormSubmission : submitSobaFormSubmission;
        const value = await write(token, submissionId, body);
        pendingRevisionRef.current = null;
        return value;
      } catch (err) {
        if (err instanceof ApiError && err.status < 500) pendingRevisionRef.current = null;
        throw err;
      }
    },
    [submissionId, signedIn, tokenFor, revisionIdFor],
  );

  const toOutcome = (value: WriteResult): WriteOutcome<WriteResult> =>
    value.revision.status === 'pending'
      ? { status: 'held', reason: value.revision.reason }
      : { status: 'applied', value };

  const save = useCallback(
    async (data: Record<string, unknown>, baseRevisionId: string) => {
      const value = await send('save', data, baseRevisionId);
      const outcome = toOutcome(value);
      // A replayed save reports where it first landed; the record may have been submitted since.
      if (outcome.status === 'applied' && value.workflowState === 'submitted') {
        return { status: 'held', reason: 'closed' } as const;
      }
      return outcome;
    },
    [send],
  );

  const submit = useCallback(
    async (data: Record<string, unknown>, baseRevisionId: string) =>
      toOutcome(await send('submit', data, baseRevisionId)),
    [send],
  );

  // Re-read the head after a held write, so the caller can write over it or, if the record is now
  // submitted, leave for the confirmation.
  const reloadHead = useCallback(
    async (): Promise<FillBundle> => getSubmitFillBundle(tokenFor(signedIn), submissionId),
    [submissionId, signedIn, tokenFor],
  );

  return { save, submit, reloadHead };
}
