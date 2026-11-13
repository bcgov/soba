import type { Request, Response } from 'express';
import { ApiErrorCodes, type EmailSubmissionCopyBody } from '@soba/lib';
import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { ServiceUnavailableError, TooManyRequestsError } from '../../core/errors';
import { getJobSettings } from '../../core/jobs/settings';
import { submitterEmailCopyJob } from '../../core/jobs/submitterEmailCopy';
import { log } from '../../core/logging';
import { resolveCaller } from '../../core/middleware/actor';
import { actorIdOf, loadedSubmission } from '../../core/middleware/formSubmitAccess';
import { notificationService } from '../notifications/service';
import { readEmailCopyLimits } from './limits';
import { queueEmailCopy } from './repo';

// Read when the module loads, so a limit out of range stops the start.
const limits = readEmailCopyLimits();

/**
 * Queues one copy of the confirmation to the address the submitter gave, and answers 202: the job
 * sends it. Runs after the feature gate and requireSubmissionEmailCopy. With notifications off
 * nothing could send it, so the request is refused rather than queued to be cancelled. A request
 * past an hourly limit is refused with 429, so the submitter knows no copy is coming.
 */
export const emailSubmissionCopy = asyncHandler(async (req: Request, res: Response) => {
  const { submission } = loadedSubmission(req);
  if (!(await notificationService.enabled())) {
    throw new ServiceUnavailableError(
      'Email is not available here',
      ApiErrorCodes.email_copy_unavailable,
    );
  }
  const { to } = req.body as EmailSubmissionCopyBody;
  const queued = await queueEmailCopy(
    {
      workspaceId: submission.workspaceId,
      formId: submission.formId,
      submissionId: submission.id,
      address: to,
      requestedBy: actorIdOf(req),
      idpCode: resolveCaller(req).idpCode,
      maxAttempts: submitterEmailCopyJob.maxAttempts ?? getJobSettings().maxAttempts,
    },
    limits,
  );
  if ('limit' in queued) {
    // Logged without the address; the scope says which limit, for whoever tunes them.
    log.warn(
      { formId: submission.formId, submissionId: submission.id, limit: queued.limit },
      'Submitter email copy refused at its hourly limit',
    );
    throw new TooManyRequestsError(
      'Too many copies were requested; try again later',
      ApiErrorCodes.email_copy_limit_reached,
    );
  }
  res.status(202).end();
});
