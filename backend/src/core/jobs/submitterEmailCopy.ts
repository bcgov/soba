import { z } from 'zod';
import { JobPool } from '../config/env';
import { JobType } from '../db/codes';
import type { JobTypeSpec } from './registry';

/** What an email copy job is given: the request it sends, which holds the address. */
export const EmailCopyJobParamsSchema = z.object({ requestId: z.uuid() });
export type EmailCopyJobParams = z.infer<typeof EmailCopyJobParamsSchema>;

/**
 * Queued with a submitter's request for a copy of their confirmation. The catalog attaches its run,
 * so queuing it does not load the handler.
 */
export const submitterEmailCopyJob: JobTypeSpec = {
  type: JobType.submission_email_copy,
  pool: JobPool.light,
  // About an hour of retries at the default backoff, to ride out a provider outage.
  maxAttempts: 8,
  timeoutMs: 300_000,
};
