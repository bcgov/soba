import type { SubmissionRecord } from '../../core/db/repos/submissionRepo';
import { formNotificationSettingsService } from '../form-settings/notification/service';
import { getNotificationAdapter } from '../../core/integrations/plugins/PluginRegistry';
import { log } from '../../core/logging';

/** Email delivery failure must not turn an accepted submission into a failed submission. */
export async function notifySubmission(submission: SubmissionRecord): Promise<void> {
  try {
    const settings = await formNotificationSettingsService.get(
      {
        workspaceId: submission.workspaceId,
        actorDisplayLabel: null,
      },
      submission.formId,
    );
    if (!settings.values.recipients.length) return;
    const adapter = getNotificationAdapter();
    // Separate emails avoid disclosing the recipient list to other recipients.
    const results = await Promise.allSettled(
      settings.values.recipients.map((address) =>
        adapter.sendEmail({
          recipients: { to: [address] },
          content: {
            subject: 'New form submission',
            body: `A new submission has been received.\n\nForm ID: ${submission.formId}\nSubmission ID: ${submission.id}\nConfirmation code: ${submission.confirmationCode}`,
            bodyType: 'text',
          },
        }),
      ),
    );
    for (const result of results) {
      if (result.status === 'rejected')
        log.error(
          { err: result.reason, submissionId: submission.id },
          'Submission notification failed',
        );
    }
  } catch (err) {
    log.error({ err, submissionId: submission.id }, 'Submission notification failed');
  }
}
