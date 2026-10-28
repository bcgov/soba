import type { Logger } from 'pino';
import type { z } from 'zod';
import type { JobPoolCode } from '../../config/env';
import type { ClaimedJob } from '../../db/repos/jobRepo';

/** Where an action is configured: a workspace default its forms inherit, or one form. */
export type PostSubmissionActionScope = 'workspace' | 'form';

/** The saved settings an action job runs with. */
export interface PostSubmissionActionSource {
  scope: PostSubmissionActionScope;
  settingId: string;
  version: number;
}

export interface PostSubmissionActionContext<TOptions> {
  job: ClaimedJob;
  /** The options saved when the submission was received, parsed by the plugin's schema. */
  options: TOptions;
  source: PostSubmissionActionSource;
  signal: AbortSignal;
  log: Logger;
}

/**
 * A post-submission action plugin: a folder under plugins/ exporting this as
 * `postSubmissionActionPluginDefinition`. POST_SUBMISSION_ACTION_PLUGINS enables it per environment.
 */
export interface PostSubmissionActionPluginDefinition<TOptions = Record<string, unknown>> {
  /** The action's key in settings and its job type. */
  code: string;
  metadata: { code: string; name: string; description?: string; version?: string };
  /** When set, the action is configurable and runs only where this feature is available. */
  featureCode?: string;
  /** Where it is configured. Without `form`, every form follows the workspace's default. */
  scopes: PostSubmissionActionScope[];
  /**
   * Parses saved options, on save and before each run. Saved settings and queued jobs keep the
   * options as they were saved, so it must keep accepting earlier shapes, converting them to the
   * current one; a save stores what it returns.
   */
  optionsSchema: z.ZodType<TOptions>;
  job: {
    pool: JobPoolCode;
    maxAttempts?: number;
    timeoutMs?: number;
    /**
     * Returning means the action is done; throwing retries it. Stop and throw when the signal
     * aborts. It can run more than once, so its side effects must be safe to repeat. An error's
     * message is stored on the job and logged, so it must not carry recipients or submission data.
     */
    run: (context: PostSubmissionActionContext<TOptions>) => Promise<void>;
  };
}
