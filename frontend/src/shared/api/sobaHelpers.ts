import { SubmitRefusalCodeSchema, type SubmitRefusalCode } from '@soba/lib';

/**
 * Carries the HTTP status so callers can tell a refusal from a failure, and the server's refusal
 * code when it sent one, so a caller can show its own message.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: SubmitRefusalCode | undefined;

  constructor(message: string, status: number, code?: SubmitRefusalCode) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * The caller is signed in and the server said no. Distinct from a load that failed, and from an
 * ended session: the API answers a permission refusal with 403, and `sobaFetch` has already turned
 * a 401 an authenticated caller could not refresh past into a `SessionExpiredError`.
 */
export const isForbidden = (err: unknown): boolean => err instanceof ApiError && err.status === 403;

export const isNotFound = (err: unknown): boolean => err instanceof ApiError && err.status === 404;

/** The server refused a write because what it targets changed since the caller read it. */
export const isConflict = (err: unknown): boolean => err instanceof ApiError && err.status === 409;

export async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Surface the backend's `{ error }` message (e.g. name-taken, disclaimer) when present, and its
    // refusal code when it is one this client knows.
    let message = `Request failed (${response.status})`;
    let code: SubmitRefusalCode | undefined;
    try {
      const body = (await response.json()) as { error?: unknown; code?: unknown };
      if (typeof body?.error === 'string' && body.error) message = body.error;
      const parsed = SubmitRefusalCodeSchema.safeParse(body?.code);
      if (parsed.success) code = parsed.data;
    } catch {
      // Non-JSON error body; keep the status-based message.
    }
    throw new ApiError(message, response.status, code);
  }
  // Unchecked cast. A caller that expects a list has to guard for one.
  return (await response.json()) as T;
}
