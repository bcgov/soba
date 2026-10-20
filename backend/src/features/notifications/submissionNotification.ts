import type { SendEmail } from '../../core/integrations/notification/NotificationAdapter';
import { getNotificationAdapter } from '../../core/integrations/plugins/PluginRegistry';
import { log } from '../../core/logging';
import { formNotificationSettingsService } from '../form-settings/notification/service';

/** What a submission notification needs, as plain data so it can be queued. */
export interface SubmissionNotificationJob {
  workspaceId: string;
  formId: string;
  submissionId: string;
  confirmationCode: string;
}

/** The email one recipient gets for a new submission. */
export const submissionEmail = (job: SubmissionNotificationJob, recipient: string): SendEmail => ({
  recipients: { to: [recipient] },
  content: {
    subject: 'New form submission',
    body: `A new submission has been received.\n\nForm ID: ${job.formId}\nSubmission ID: ${job.submissionId}\nConfirmation code: ${job.confirmationCode}`,
    bodyType: 'text',
  },
});

/**
 * Emails each of the form's recipients separately, so no recipient sees the others. Never rejects:
 * a failed send is logged and must not fail the submission.
 */
export async function deliverSubmissionNotification(job: SubmissionNotificationJob): Promise<void> {
  try {
    const settings = await formNotificationSettingsService.get(
      { workspaceId: job.workspaceId, actorDisplayLabel: null },
      job.formId,
    );
    const { recipients } = settings.values;
    if (recipients.length === 0) return;
    const adapter = getNotificationAdapter();
    const results = await Promise.allSettled(
      recipients.map((recipient) => adapter.sendEmail(submissionEmail(job, recipient))),
    );
    const receipts = results.flatMap((result) => {
      if (result.status === 'fulfilled') return [result.value];
      log.error(
        { err: result.reason, submissionId: job.submissionId },
        'Submission notification failed',
      );
      return [];
    });
    log.info(
      {
        submissionId: job.submissionId,
        accepted: receipts.length,
        failed: results.length - receipts.length,
        notificationIds: receipts.map((receipt) => receipt.id),
        statuses: [...new Set(receipts.map((receipt) => receipt.status))],
      },
      'Submission notifications dispatched',
    );
  } catch (err) {
    log.error({ err, submissionId: job.submissionId }, 'Submission notification failed');
  }
}

/**
 * Sends a submission notification without blocking the caller. Delivery is in-process and
 * best-effort: a send in flight when the pod stops is lost.
 */
export function enqueueSubmissionNotification(job: SubmissionNotificationJob): void {
  void deliverSubmissionNotification(job);
}
