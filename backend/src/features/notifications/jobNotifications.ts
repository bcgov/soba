import { listJobNotificationSends, readEmailDay } from '../../core/db/repos/notificationAuditRepo';
import { limitPauseEnds, roomToday } from '../../core/integrations/notification/emailBudget';
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

  async emailRoom() {
    const { dailyLimit, dailyResetTimeZone } = getNotificationSettings();
    const day = await readEmailDay(dailyResetTimeZone, REFUSED_HTTP_STATUSES);
    const pauseEnds = limitPauseEnds(day.lastLimitedAt, day.limitedInARow, day.now);
    return {
      room: roomToday(dailyLimit, day.counted),
      resetInMs: day.resetsAt.getTime() - day.now.getTime(),
      pauseLeftMs: pauseEnds && pauseEnds.getTime() - day.now.getTime(),
    };
  },
});
