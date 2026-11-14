import { canEmailSubmissionCopy, isIdentifiedCaller } from '@soba/lib';
import { env } from '../../core/config/env';
import { Features } from '../../core/db/codes';
import { findSubmitterSubmission } from '../../core/db/repos/submitterSubmissionRepo';
import { sendEachAddress } from '../../core/integrations/notification/sendEachAddress';
import type { JobContext } from '../../core/jobs/registry';
import { JobCancelledError } from '../../core/jobs/settlement';
import { EmailCopyJobParamsSchema } from '../../core/jobs/submitterEmailCopy';
import { isFeatureAvailable } from '../../core/services/featureAvailabilityService';
import { jobNotifications } from '../notifications/jobNotifications';
import { buildEmailCopy } from './email';
import { findEmailCopyRequest } from './repo';

/** Recorded as the job's error. None names the address or the form: staff read job errors. */
export const EMAIL_COPY_REQUEST_GONE = 'The request is gone';
export const EMAIL_COPY_GONE = 'The submission is no longer available';
export const EMAIL_COPY_NOT_ALLOWED = 'The submission can no longer be emailed';
export const EMAIL_COPY_TURNED_OFF = 'Submitter email copy is turned off';

/**
 * Sends the copy a submitter asked for. Everything the request checked is checked again, reading
 * the submission as the requester did, since settings, access or the feature may have changed while
 * it waited. Sends are attributed to the requester, or to whoever ran this job again.
 */
export const runEmailCopy = async ({ job, signal, log }: JobContext): Promise<void> => {
  const { requestId } = EmailCopyJobParamsSchema.parse(job.params);
  const request = job.submissionId ? await findEmailCopyRequest(requestId, job.submissionId) : null;
  if (!request) throw new JobCancelledError(EMAIL_COPY_REQUEST_GONE);
  const loaded = await findSubmitterSubmission({
    submissionId: request.submissionId,
    actorId: request.requestedBy,
    idpCode: request.idpCode,
  });
  if (!loaded) throw new JobCancelledError(EMAIL_COPY_GONE);
  if (!canEmailSubmissionCopy(loaded.access, loaded.form)) {
    throw new JobCancelledError(EMAIL_COPY_NOT_ALLOWED);
  }
  const scope = { workspaceId: request.workspaceId, formId: loaded.form.id };
  if (!(await isFeatureAvailable(Features.submitter_email_copy, scope))) {
    throw new JobCancelledError(EMAIL_COPY_TURNED_OFF);
  }
  const content = buildEmailCopy(
    {
      submissionId: request.submissionId,
      formName: loaded.form.name ?? '',
      confirmationCode: loaded.submission.confirmationCode,
      signedIn: isIdentifiedCaller({ idpCode: request.idpCode }),
    },
    env.getFormsAppUrl(),
  );
  const actorId = job.lastRequeuedBy ?? job.createdBy;
  await sendEachAddress(
    { notifications: jobNotifications(job, () => Promise.resolve(actorId)), signal, log },
    [request.address],
    content,
  );
};
