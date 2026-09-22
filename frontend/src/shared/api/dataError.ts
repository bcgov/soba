import type { DataError } from './dataContracts';
import { isSessionExpired } from './sobaFetch';
import { isForbidden, isNotFound } from './sobaHelpers';

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

export { isSessionExpired } from './sobaFetch';
export { isForbidden, isNotFound, isConflict } from './sobaHelpers';
