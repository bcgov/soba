'use client';

import { useCallback } from 'react';
import type { NameAvailabilityResponse } from '@soba/lib';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useAuthedSWR } from './useAuthedSWR';
import { isForbidden, isNotFound } from './sobaHelpers';
import { isSessionExpired } from './sobaFetch';

/** How long to wait after the last keystroke before checking a name. */
export const NAME_CHECK_DEBOUNCE_MS = 400;

export type NameCheckStatus = 'checking' | 'available' | 'unavailable' | null;

export type NameCheckLabels = { checking: string; available: string; unavailable: string };

export interface NameCheckInput {
  /** The name as typed; checked trimmed, as a save trims it. */
  name: string;
  /**
   * What is checked: the check's own key, then whatever scopes it (a workspace, a form). Null while
   * there is nothing to check against yet, or nothing that could be saved.
   */
  scope: readonly string[] | null;
  /** The name the record already has. It can't collide with itself, so it isn't checked. */
  savedName?: string;
  /** Asks the server; resolves whether the name is free. */
  check: (token: string, name: string) => Promise<NameAvailabilityResponse>;
  labels: NameCheckLabels;
}

export interface NameCheck {
  status: NameCheckStatus;
  /**
   * Whether a save must wait: the name is still being checked, or is taken. A check that failed
   * doesn't block it, since the save is checked again on the server.
   */
  blocksSave: boolean;
  /** For the field: "Checking…" or "Available ✓". */
  description: string | undefined;
  /** For the field, with `isInvalid`: the name is taken. */
  errorMessage: string | undefined;
  /** For a polite live region: the result only, as "Checking" on every pause would be noise. */
  announcement: string;
  /** Asks again, so a stale "Available" doesn't sit next to a save the name was just refused for. */
  revalidate: () => void;
}

/** A refusal or a missing record is the answer: retrying it only repeats the request. */
const noRetryOnRefusal = {
  shouldRetryOnError: (err: unknown) =>
    !isSessionExpired(err) && !isForbidden(err) && !isNotFound(err),
};

/**
 * A live check that a name is free, as it is typed, for the field that names a record. Waits for
 * the typing to settle on the name shown, so a result for an earlier keystroke never flashes.
 */
export function useNameCheck({ name, scope, savedName, check, labels }: NameCheckInput): NameCheck {
  const trimmed = name.trim();
  const settled = useDebouncedValue(trimmed, NAME_CHECK_DEBOUNCE_MS);
  const unchanged = trimmed === savedName?.trim();
  const reportable = trimmed.length > 0 && scope !== null && !unchanged;
  const ready = reportable && settled === trimmed;

  const { data, isLoading, mutate } = useAuthedSWR<NameAvailabilityResponse>(
    ready ? ['name-availability', ...scope, settled] : null,
    (token) => check(token, settled),
    noRetryOnRefusal,
  );
  const revalidate = useCallback(() => {
    void mutate();
  }, [mutate]);

  let status: NameCheckStatus = null;
  if (reportable) {
    if (!ready || isLoading) status = 'checking';
    else if (data?.available === true) status = 'available';
    else if (data?.available === false) status = 'unavailable';
  }

  return {
    status,
    blocksSave: status === 'checking' || status === 'unavailable',
    description:
      (status === 'checking' && labels.checking) ||
      (status === 'available' && `${labels.available} ✓`) ||
      undefined,
    errorMessage: status === 'unavailable' ? `${labels.unavailable} ✕` : undefined,
    announcement:
      (status === 'available' && labels.available) ||
      (status === 'unavailable' && labels.unavailable) ||
      '',
    revalidate,
  };
}
