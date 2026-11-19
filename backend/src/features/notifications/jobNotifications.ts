import {
  countNotificationSendsSince,
  listJobNotificationSends,
} from '../../core/db/repos/notificationAuditRepo';
import { lastMidnight, nextMidnight } from '../../core/integrations/notification/dailyReset';
import type { JobNotifications } from '../../core/integrations/notification/JobNotifications';
import {
  isHandledForRun,
  isSentSend,
  REFUSED_HTTP_STATUSES,
} from '../../core/integrations/notification/sendOutcome';
import { getNotificationSettings } from '../../core/integrations/notification/settings';
import type { JobFacts } from '../../core/jobs/facts';
import { notificationService } from './service';

/**
 * The notification service for one job. Sends carry the job's ids into the audit and are
 * attributed to the user `actorId` resolves to, read at each send.
 */
export const jobNotifications = (
  job: JobFacts,
  actorId: () => Promise<string>,
): JobNotifications => ({
  enabled: () => notificationService.enabled(),

  async sendEmail(email) {
    const { outcome, httpStatus, audited } = await notificationService.sendEmail(
      {
        workspaceId: job.workspaceId,
        formId: job.formId,
        submissionId: job.submissionId,
        actorId: await actorId(),
        jobId: job.id,
      },
      email,
    );
    return { outcome, httpStatus, audited };
  },

  async handled() {
    const sends = await listJobNotificationSends(job.id);
    return {
      recipients: new Set(
        sends
          .filter((send) => isHandledForRun(send, job.run.queuedAt))
          .flatMap((send) => send.recipients.to),
      ),
      anySent: sends.some(isSentSend),
    };
  },

  async dailyRoom() {
    const { dailyLimit, dailyResetTimeZone } = getNotificationSettings();
    // One reading of the clock, so a count that crosses midnight still waits for the right reset.
    const now = new Date();
    const sent = await countNotificationSendsSince(
      lastMidnight(now, dailyResetTimeZone),
      REFUSED_HTTP_STATUSES,
    );
    return {
      room: Math.max(dailyLimit - sent, 0),
      resetsAt: nextMidnight(now, dailyResetTimeZone),
    };
  },
});
