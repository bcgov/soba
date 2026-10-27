import type { Logger } from 'pino';
import type { JobPoolCode } from '../config/env';
import type { ClaimedJob } from '../db/repos/jobRepo';

export interface JobContext {
  job: ClaimedJob;
  /**
   * Aborted when the job is cancelled, times out, loses its lease, or the pod shuts down. The
   * handler must then stop and throw: returning records the job as succeeded.
   */
  signal: AbortSignal;
  log: Logger;
}

export interface JobTypeDefinition {
  type: string;
  pool: JobPoolCode;
  /** Attempts before the job is dead; JOB_MAX_ATTEMPTS when unset. */
  maxAttempts?: number;
  /** Run time before the handler is aborted; the pool's JOB_*_TIMEOUT_MS when unset. */
  timeoutMs?: number;
  /**
   * Returning means the work is done, even after an abort; throwing retries the job until its
   * attempts run out. A job runs at least once, and after a lost lease two pods can run it at the
   * same time, so its side effects must be safe to repeat.
   */
  run: (context: JobContext) => Promise<void>;
}

export class JobRegistry {
  private readonly definitions = new Map<string, JobTypeDefinition>();

  register(definition: JobTypeDefinition): this {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Job type '${definition.type}' is already registered`);
    }
    this.definitions.set(definition.type, definition);
    return this;
  }

  get(type: string): JobTypeDefinition | undefined {
    return this.definitions.get(type);
  }

  require(type: string): JobTypeDefinition {
    const definition = this.definitions.get(type);
    if (!definition) throw new Error(`Job type '${type}' is not registered`);
    return definition;
  }

  typesIn(pool: JobPoolCode): string[] {
    return [...this.definitions.values()]
      .filter((definition) => definition.pool === pool)
      .map((definition) => definition.type);
  }
}
