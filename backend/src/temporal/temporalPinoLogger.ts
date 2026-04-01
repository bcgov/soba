import type { Logger as PinoLogger } from 'pino';
import type { Logger as TemporalLogger, LogLevel, LogMetadata } from '@temporalio/worker';

function toBindings(meta?: LogMetadata): Record<string, unknown> {
  if (meta == null || typeof meta !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(meta)) {
    out[String(key)] = (meta as Record<string | symbol, unknown>)[key as string | symbol];
  }
  return out;
}

/**
 * Bridges Temporal SDK logging to pino so worker / core messages use the app logger.
 */
export function createTemporalPinoLogger(pino: PinoLogger): TemporalLogger {
  return {
    log(level: LogLevel, message: string, meta?: LogMetadata) {
      const bindings = toBindings(meta);
      switch (level) {
        case 'TRACE':
          pino.trace(bindings, message);
          break;
        case 'DEBUG':
          pino.debug(bindings, message);
          break;
        case 'INFO':
          pino.info(bindings, message);
          break;
        case 'WARN':
          pino.warn(bindings, message);
          break;
        case 'ERROR':
          pino.error(bindings, message);
          break;
        default:
          pino.info({ ...bindings, unknownTemporalLogLevel: level }, message);
      }
    },
    trace(message: string, meta?: LogMetadata) {
      pino.trace(toBindings(meta), message);
    },
    debug(message: string, meta?: LogMetadata) {
      pino.debug(toBindings(meta), message);
    },
    info(message: string, meta?: LogMetadata) {
      pino.info(toBindings(meta), message);
    },
    warn(message: string, meta?: LogMetadata) {
      pino.warn(toBindings(meta), message);
    },
    error(message: string, meta?: LogMetadata) {
      pino.error(toBindings(meta), message);
    },
  };
}
