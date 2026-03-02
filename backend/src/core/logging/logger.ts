import pino from 'pino';
import rTracer from 'cls-rtracer';
import { createDevPrettyStream } from './devPrettyStream';

/**
 * Correlation ID (request id) from CLS. Use this when building log payloads
 * or integrating with systems that need the id (e.g. DB query loggers).
 * Returns undefined when not inside a request (e.g. worker, startup).
 */
export function getCorrelationId(): string | undefined {
  const id = rTracer.id();
  return id != null ? String(id) : undefined;
}

const isDev = process.env.NODE_ENV !== 'production';

const pinoOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  mixin() {
    const requestId = getCorrelationId();
    return requestId != null ? { requestId } : {};
  },
};

if (isDev) {
  const devStream = createDevPrettyStream();
  devStream.pipe(process.stdout);
  Object.assign(pinoOptions, { dest: devStream });
}

const rootLogger = pino(pinoOptions);

/**
 * Application logger. Every log entry automatically includes the current
 * request's correlation id (when running inside a request context from cls-rtracer).
 * Use log.info(), log.error(), log.warn(), log.debug() as usual.
 */
export const log = rootLogger;

export default log;
