import type { Logger } from 'drizzle-orm/logger';
import { log } from '../logging';

/**
 * Drizzle logger that writes query logs through the app logger.
 * Correlation id is added automatically via the logger mixin when inside a request.
 */
export const drizzleQueryLogger: Logger = {
  logQuery(query: string, params: unknown[]): void {
    log.debug({ query, params }, 'db query');
  },
};
