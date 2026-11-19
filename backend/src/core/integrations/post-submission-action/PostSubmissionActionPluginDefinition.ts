import type { Readable } from 'node:stream';
import type { Logger } from 'pino';
import type { z } from 'zod';
import type { PostSubmissionActionScope } from '@soba/lib';
import type { JobPoolCode } from '../../config/env';
import type { JobFacts } from '../../jobs/facts';
import type { JobResultFacts } from '../../jobs/outputs';
import type { StoredJobResult } from '../../jobs/registry';
import type { SendEmail } from '../notification/NotificationAdapter';
import type { TempResource, TempStorageAdapter } from '../temp-storage/TempStorageAdapter';

export type { PostSubmissionActionScope };

/** The saved settings an action job runs with. */
export interface PostSubmissionActionSource {
  scope: PostSubmissionActionScope;
  settingId: string;
  version: number;
}

/** The submission an action job runs for, with names as they are when the job runs. */
export interface PostSubmissionActionSubmission {
  id: string;
  formId: string;
  formVersionId: string;
  formName: string;
  workspaceId: string;
  workspaceName: string;
  confirmationCode: string;
}

/**
 * An action job's facts. It is always about a submission, and `revisionId` is the revision whose
 * submit queued it, which a later submit can have replaced as the submission's latest.
 */
export type PostSubmissionActionJob = JobFacts & { submissionId: string; revisionId: string };

/** An email's subject, body and body type, the same for every address it goes to. */
export type PostSubmissionActionEmailContent = SendEmail['content'];

/** Email for the job: sends are audited against it and attributed to the system user. */
export interface PostSubmissionActionNotifications {
  /**
   * Send `content` to each address, one email each, skipping those the job already handled, and no
   * more than the environment's daily limit allows. Past it, or at the provider's limit, it throws
   * `JobDeferredError` and the rest go after the daily reset; it throws `JobCancelledError` when
   * notifications are off or every address was refused. Any other failure throws, so the attempt
   * retries.
   */
  sendToEach(
    addresses: readonly string[],
    content: PostSubmissionActionEmailContent,
  ): Promise<void>;
}

/** Which submits queue an action: every submit, or the submission's first only. */
export type PostSubmissionActionSubmits = 'every' | 'first';

/**
 * How a render ended: `ok` with the document; `no-template` when the form version has no CDOGS
 * template; `unavailable` when no document generation backend serves the form; `busy` when every
 * render slot is taken; `refused` when the template is not renderable, the backend refused it or
 * the data, or the revision is not one of the submission's submitted revisions; `failed` when the
 * backend or the template's storage failed.
 */
export type PostSubmissionActionRenderOutcome =
  | { status: 'ok'; data: Buffer; contentType?: string }
  | { status: 'no-template' | 'unavailable' | 'busy' | 'refused' | 'failed' };

/** A file uploaded to the job's submission, open for reading. */
export interface PostSubmissionActionUpload {
  filename: string;
  /** The file row's type, else the one storage reports; null when neither has one. */
  contentType: string | null;
  /** The size storage reports, else the file row's; null when neither has one. */
  size: number | null;
  stream: Readable;
}

/** Services the framework passes to an action, so plugins do not import feature code. */
export interface PostSubmissionActionServices {
  notifications: PostSubmissionActionNotifications;
  tempStorage: Pick<TempStorageAdapter, 'reserve' | 'remove'>;
  answers: {
    /**
     * The answers a revision of the job's submission left. Null when the id is not one of the
     * submission's revisions, the revision is pending, or there is nothing to read. An engine error
     * throws, with a fixed message, so the attempt retries.
     */
    readRevision(revisionId: string): Promise<Record<string, unknown> | null>;
  };
  documents: {
    /**
     * Render the answers as a PDF with the CDOGS template on the submission's form version, with
     * the print context of the submitted revision (its number and the confirmation code), audited
     * as the system user against the revision.
     */
    render(input: {
      revisionId: string;
      answers: Record<string, unknown>;
    }): Promise<PostSubmissionActionRenderOutcome>;
  };
  files: {
    /**
     * A file uploaded to the job's submission; 'missing' when the id is not one of the submission's
     * files, a deleted file included. Throws, with a fixed message, when storage cannot serve it, so
     * the attempt retries.
     */
    open(fileId: string): Promise<PostSubmissionActionUpload | 'missing'>;
  };
}

/** Where an action stores the file it produced, as its job's result. */
export interface PostSubmissionActionResult {
  /** The largest file `store` accepts. */
  maxBytes: number;
  /**
   * Store a staged file as the job's result, attributed to the system user, replacing any earlier
   * one. The caller still removes the staged file. Throws `JobFailedError` over `maxBytes`, and
   * `JobCancelledError` once a stop was asked for.
   */
  store(
    staged: TempResource,
    meta: { filename: string; contentType: string },
  ): Promise<StoredJobResult>;
}

/** A result a step stored: ready to read until it expires, then expired. */
export type PostSubmissionActionStoredResult = JobResultFacts;

/** The step before this one, which succeeded: its job and the result it stored. */
export interface PostSubmissionActionPreviousStep {
  jobId: string;
  /** Null when it stored none. */
  result: PostSubmissionActionStoredResult | null;
}

export interface PostSubmissionActionContext<TOptions> {
  job: PostSubmissionActionJob;
  /** The step before this one; null on the first step. */
  previous: PostSubmissionActionPreviousStep | null;
  /** The options saved when the submission was received, parsed by the plugin's schema. */
  options: TOptions;
  source: PostSubmissionActionSource;
  submission: PostSubmissionActionSubmission;
  services: PostSubmissionActionServices;
  result: PostSubmissionActionResult;
  /** How far the run has got. Written at most every JOB_PROGRESS_INTERVAL_MS, and with the outcome. */
  reportProgress: (done: number, total?: number | null) => void;
  signal: AbortSignal;
  log: Logger;
}

/** How one step of an action runs as a job. */
export interface PostSubmissionActionJobSettings<TOptions = Record<string, unknown>> {
  pool: JobPoolCode;
  maxAttempts?: number;
  timeoutMs?: number;
  /** Days a stored result is kept; JOB_RESULT_RETENTION_DAYS when unset. */
  resultRetentionDays?: number;
  /** Keep the result until it expires even when the job ends dead or cancelled. */
  keepResultWhenEnded?: boolean;
  /**
   * Returning means the step is done; throwing retries it, and throwing `JobDeferredError` runs it
   * again after its delay without using an attempt. Stop and throw when the signal aborts. It can
   * run more than once, so its side effects must be safe to repeat. An error's message is stored on
   * the job and logged, so it must not carry recipients or submission data.
   */
  run: (context: PostSubmissionActionContext<TOptions>) => Promise<void>;
}

/** A step after the first: its own job, typed `<code>:<name>`. */
export interface PostSubmissionActionStep<
  TOptions = Record<string, unknown>,
> extends PostSubmissionActionJobSettings<TOptions> {
  /** Lowercase words joined by dashes, unique within the action. */
  name: string;
}

/**
 * A post-submission action plugin: a folder under plugins/ exporting this as
 * `postSubmissionActionPluginDefinition`. POST_SUBMISSION_ACTION_PLUGINS enables it per environment.
 */
export interface PostSubmissionActionPluginDefinition<TOptions = Record<string, unknown>> {
  /** The action's key in settings, and the job type of its first step. */
  code: string;
  metadata: { code: string; name: string; description?: string; version?: string };
  /** When set, the action is configurable and runs only where this feature is available. */
  featureCode?: string;
  /** Where it is configured. Without `form`, every form follows the workspace's default. */
  scopes: PostSubmissionActionScope[];
  /** Which submits queue the action; 'every' when unset. */
  submits?: PostSubmissionActionSubmits;
  /**
   * Parses saved options, on save and before each run. Saved settings and queued jobs keep the
   * options as they were saved, so it must keep accepting earlier shapes, converting them to the
   * current one; a save stores what it returns.
   */
  optionsSchema: z.ZodType<TOptions>;
  /** The first step, typed by the code. */
  job: PostSubmissionActionJobSettings<TOptions>;
  /**
   * Steps after the first, in order. Each is queued with the success of the step before it, with the
   * same options, and runs the same start check as the first.
   */
  steps?: PostSubmissionActionStep<TOptions>[];
}
