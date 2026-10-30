import type { Logger } from 'pino';
import type { JobSettings } from '../config/env';
import { sweepJobs } from '../db/repos/jobRepo';
import { jitteredMs } from './timing';

/** Periodically requeues jobs whose worker died and deletes finished jobs past retention. */
export class JobSweeper {
  private timer?: NodeJS.Timeout;
  private sweeping: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    private readonly settings: JobSettings,
    private readonly log: Logger,
  ) {}

  /** Call outside any request: the sweep timers keep the context they start in. */
  start(): void {
    this.schedule();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.sweeping;
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      this.sweeping = this.sweep();
    }, jitteredMs(this.settings.sweepIntervalMs));
  }

  private async sweep(): Promise<void> {
    try {
      const result = await sweepJobs(this.settings);
      if (Object.values(result).some((count) => count > 0)) this.log.info(result, 'Job sweep');
    } catch (err) {
      this.log.error({ err }, 'Job sweep failed');
    }
    if (!this.stopped) this.schedule();
  }
}
