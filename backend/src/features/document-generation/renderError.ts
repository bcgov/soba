import { AppError, ServiceUnavailableError, UnprocessableEntityError } from '../../core/errors';
import { upstreamStatusOf } from '../../core/http/httpErrorMapper';
import { log } from '../../core/logging';

export const TEMPLATE_NOT_RENDERED = 'Template could not be rendered';
const GENERATION_UNAVAILABLE = 'Document generation is unavailable';

/**
 * The error a render failure returns to the caller: a backend refusal (4xx) is a generic 422, any
 * other failure a generic 503.
 */
export function toRenderError(
  err: unknown,
  context: { code: string; templateId: string },
): AppError {
  if (!(err instanceof AppError)) {
    log.error(
      { ...context, err },
      'document generation backend failed (config or unexpected error)',
    );
    return new ServiceUnavailableError(GENERATION_UNAVAILABLE);
  }
  // PI-safe: log statuses and the error class only, never the backend's message, which can carry
  // its response body.
  const failure = {
    ...context,
    status: err.statusCode,
    upstreamStatus: upstreamStatusOf(err),
    error: err.name,
  };
  if (err.statusCode >= 500) {
    log.warn(failure, 'document generation backend failed');
    return new ServiceUnavailableError(GENERATION_UNAVAILABLE);
  }
  log.warn(failure, 'document generation backend refused the render');
  return new UnprocessableEntityError(TEMPLATE_NOT_RENDERED);
}
