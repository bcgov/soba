import type { SubmitErrorCode } from '@soba/lib';
import type { DataError } from './dataContracts';
import { isSessionExpired } from './sobaFetch';
import { ApiError, isForbidden, isNotFound } from './sobaHelpers';

/**
 * The single place an API failure becomes a `DataError`. Callers outside the api folder reach the
 * error predicates through here so they do not import the fetch module directly.
 */
export function classifyDataError(cause: unknown): DataError {
  if (isSessionExpired(cause)) return { kind: 'sessionExpired', cause };
  if (isForbidden(cause)) return { kind: 'forbidden', cause };
  if (isNotFound(cause)) return { kind: 'notFound', cause };
  // A fetch that never reached the server throws a TypeError.
  if (cause instanceof TypeError) return { kind: 'offline', cause };
  return { kind: 'failed', cause };
}

/** Messages per error kind. `failed` is the fallback for any kind the caller does not name. */
export type DataErrorMessages = Partial<Record<DataError['kind'], string>> & { failed: string };

export function messageForDataError(error: DataError, messages: DataErrorMessages): string {
  return messages[error.kind] ?? messages.failed;
}

/** A request the server failed on (5xx) or that never reached it. */
const isServerOrNetworkFailure = (cause: unknown): boolean =>
  (cause instanceof ApiError && cause.status >= 500) || classifyDataError(cause).kind === 'offline';

/**
 * The message for an error the server sent a code with. Without a code, `failed` stands in for a
 * server or network failure; any other error is null, so the caller can show the server's text.
 */
export function submitErrorMessage(
  cause: unknown,
  messages: Record<SubmitErrorCode, string>,
  failed?: string,
): string | null {
  if (cause instanceof ApiError && cause.code) return messages[cause.code];
  return failed !== undefined && isServerOrNetworkFailure(cause) ? failed : null;
}

export { isSessionExpired } from './sobaFetch';
export { isForbidden, isNotFound, isConflict } from './sobaHelpers';
