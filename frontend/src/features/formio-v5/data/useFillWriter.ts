'use client';

import { useCallback, useRef, useState } from 'react';
import { useCallToken } from '@/src/shared/api/callToken';
import type { WriteOutcome } from '@/src/shared/api/dataContracts';
import { useSubmissionWriter, type WriteResult } from './useSubmissionWriter';

export type FillWrite = 'save' | 'submit';
/** `resolve`: reloading or writing over after a held write. */
export type FillBusy = FillWrite | 'resolve';

/** The reason a write refused without sending carries. */
export const BLOCKED_REASON = 'blocked';
const BLOCKED: WriteOutcome<WriteResult> = { status: 'held', reason: BLOCKED_REASON };

const required = (base: { current: string | null }) => {
  if (base.current === null) throw new Error('No head revision to write on');
  return base.current;
};

/**
 * The writes of one loaded bundle. Each write is based on the head it knows: the loaded head, then
 * each applied save, or the head re-read when the filler keeps their version. A submit waits for a
 * save in flight and is based on the revision that save produces. A write held as a conflict blocks
 * every later write until the filler reloads or keeps theirs; a record found submitted blocks every
 * later write. A blocked write sends nothing and returns held with BLOCKED_REASON. Writes go out as
 * the session was when the form mounted: signed in, or anonymous.
 */
export function useFillWriter(submissionId: string, headRevisionId: string | null) {
  const { isSignedIn } = useCallToken();
  const [signedIn] = useState(isSignedIn);
  const writer = useSubmissionWriter(submissionId, signedIn);

  const baseRef = useRef(headRevisionId);
  const saveInFlightRef = useRef<Promise<unknown> | null>(null);
  const [busy, setBusy] = useState<FillBusy | null>(null);
  const [held, setHeld] = useState<FillWrite | null>(null);
  // Read by a submit that waited on a save, so it sees what that save left.
  const heldRef = useRef<FillWrite | null>(null);
  const hold = useCallback((kind: FillWrite | null) => {
    heldRef.current = kind;
    setHeld(kind);
  }, []);
  // The record is submitted; the caller leaves.
  const closedRef = useRef(false);
  const blocked = useCallback(() => heldRef.current !== null || closedRef.current, []);

  const hasBase = useCallback(() => baseRef.current !== null, []);

  const settle = useCallback(
    (kind: FillWrite, outcome: WriteOutcome<WriteResult>) => {
      if (outcome.status === 'applied') {
        if (kind === 'save') baseRef.current = outcome.value.revision.id;
        hold(null);
      } else if (outcome.status === 'held') {
        if (outcome.reason === 'closed') closedRef.current = true;
        else hold(kind);
      }
      return outcome;
    },
    [hold],
  );

  const save = useCallback(
    async (data: Record<string, unknown>): Promise<WriteOutcome<WriteResult>> => {
      if (blocked()) return BLOCKED;
      setBusy('save');
      const run = writer.save(data, required(baseRef)).then((outcome) => settle('save', outcome));
      const inFlight = run.catch(() => undefined);
      saveInFlightRef.current = inFlight;
      try {
        return await run;
      } finally {
        if (saveInFlightRef.current === inFlight) saveInFlightRef.current = null;
        setBusy(null);
      }
    },
    [writer, settle, blocked],
  );

  const submit = useCallback(
    async (data: Record<string, unknown>): Promise<WriteOutcome<WriteResult>> => {
      await saveInFlightRef.current;
      if (blocked()) return BLOCKED;
      setBusy('submit');
      try {
        return settle('submit', await writer.submit(data, required(baseRef)));
      } finally {
        setBusy(null);
      }
    },
    [writer, settle, blocked],
  );

  /**
   * Re-reads the head and bases the next write on it, releasing the held write for the caller to
   * send again. `closed` when the record is now submitted; null when nothing is held.
   */
  const keepMine = useCallback(async (): Promise<FillWrite | 'closed' | null> => {
    const kind = heldRef.current;
    if (!kind) return null;
    setBusy('resolve');
    let head: Awaited<ReturnType<typeof writer.reloadHead>>;
    try {
      head = await writer.reloadHead();
    } catch (err) {
      setBusy(null);
      throw err;
    }
    // Stays busy: the caller leaves for the submitted record.
    if (head.workflowState === 'submitted') return 'closed';
    setBusy(null);
    baseRef.current = head.headRevisionId;
    hold(null);
    return kind;
  }, [writer, hold]);

  /** Drops the held write; `reload` mounts a new form on the latest bundle. */
  const discardMine = useCallback(
    async (reload: () => Promise<void>) => {
      setBusy('resolve');
      try {
        hold(null);
        await reload();
      } finally {
        setBusy(null);
      }
    },
    [hold],
  );

  return {
    signedIn,
    status: { busy, held },
    hasBase,
    save,
    submit,
    keepMine,
    discardMine,
  };
}
