import {
  AppError,
  ServiceUnavailableError,
  UnprocessableEntityError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../errors';
import { BinaryResponse, HttpClient, HttpClientError } from './httpClient';

// Bound upstream detail so a large or binary error body can't bloat our logs or response.
const MAX_DETAIL = 500;

const boundedDetail = (body: string): string =>
  body.length > MAX_DETAIL ? `${body.slice(0, MAX_DETAIL)}…` : body;

/**
 * Translate an outbound HttpClientError into the app error hierarchy so the central error
 * handler renders a sensible status. Only bad-request statuses (400/415/422) become client
 * errors; auth, rate-limit, not-found, 5xx, and transport failures (anything that is not an
 * HttpClientError) are the service's problem and become 503.
 */
export function httpErrorToAppError(err: unknown, service: string): AppError {
  if (!(err instanceof HttpClientError)) {
    const message = err instanceof Error ? err.message : String(err);
    return new ServiceUnavailableError(`${service} is unavailable: ${message}`);
  }

  const detail = boundedDetail(err.body) || err.statusText;
  const message = `${service} error ${err.status}: ${detail}`;

  if (err.status === 400) return new ValidationError(message);
  if (err.status === 415) return new UnsupportedMediaTypeError(message);
  if (err.status === 422) return new UnprocessableEntityError(message);
  return new ServiceUnavailableError(message);
}

/** POST a JSON payload for binary bytes, translating any transport/HTTP failure to an AppError. */
export async function postBinaryOrThrow(
  http: HttpClient,
  path: string,
  payload: unknown,
  service: string,
): Promise<BinaryResponse> {
  try {
    return await http.postJsonForBinary(path, payload);
  } catch (err) {
    throw httpErrorToAppError(err, service);
  }
}
