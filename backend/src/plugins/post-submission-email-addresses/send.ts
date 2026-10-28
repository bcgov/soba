import type { PostSubmissionEmailAddressesOptions } from '@soba/lib';
import { NotificationOutcome } from '../../core/db/codes';
import { isRefusedSend } from '../../core/integrations/notification/sendOutcome';
import type { PostSubmissionActionContext } from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';
import { JobCancelledError } from '../../core/jobs/settlement';
import { exceededLimit, type HourlyLimits } from './limits';
import { buildNotice, type Notice } from './notice';

const HOUR_SECONDS = 3600;

type SendContext = PostSubmissionActionContext<PostSubmissionEmailAddressesOptions>;

const NOTIFICATIONS_OFF = 'Notifications are off';

interface Tally {
  sent: number;
  refused: number;
}

/** Ends the job cancelled, before anything is sent, when this list would pass an hourly limit. */
const checkBudgets = async (
  notifications: SendContext['services']['notifications'],
  toSend: number,
  limits: HourlyLimits,
): Promise<void> => {
  const [form, workspace, environment] = await Promise.all([
    notifications.sentSince('form', HOUR_SECONDS),
    notifications.sentSince('workspace', HOUR_SECONDS),
    notifications.sentSince('environment', HOUR_SECONDS),
  ]);
  const over = exceededLimit({ form, workspace, environment }, toSend, limits);
  if (over) {
    throw new JobCancelledError(
      `Hourly email limit for the ${over.scope} reached: ${over.sent} sent in the last hour, ${toSend} to send, limit ${over.limit}`,
    );
  }
};

/**
 * Sends the notice to each address not yet handled for this job, one email per address. A refused
 * address is recorded and skipped; a fresh list refused at every address ends cancelled. Any other
 * failure, a missing audit row or an abort stops the run and throws, so the job retries and the
 * retry skips what was handled. Budgets are checked only before a list starts, so a retry finishes
 * a started list.
 */
export const sendNotices = async (
  { options, submission, services, signal, log }: SendContext,
  limits: HourlyLimits,
  link: string | null,
): Promise<void> => {
  const { notifications } = services;
  const handled = await notifications.handledRecipients();
  const remaining = options.to.filter((address) => !handled.has(address));
  if (remaining.length === 0) return;
  if (!(await notifications.enabled())) throw new JobCancelledError(NOTIFICATIONS_OFF);
  if (handled.size === 0) await checkBudgets(notifications, remaining.length, limits);

  const notice: Notice = buildNotice(submission, link);
  // One send at a time, so a failure stops the rest of the list.
  const sendFrom = async (index: number, tally: Tally): Promise<Tally> => {
    if (index === remaining.length) return tally;
    signal.throwIfAborted();
    const result = await notifications.sendEmail({
      recipients: { to: [remaining[index]] },
      content: { subject: notice.subject, body: notice.body, bodyType: 'text' },
    });
    const stoppedAt = `after ${tally.sent} of ${remaining.length}`;
    if (!result.audited) throw new Error(`A send was not recorded; stopping ${stoppedAt}`);
    if (result.outcome === NotificationOutcome.disabled) {
      throw new JobCancelledError(NOTIFICATIONS_OFF);
    }
    if (isRefusedSend(result)) return sendFrom(index + 1, { ...tally, refused: tally.refused + 1 });
    if (result.outcome === NotificationOutcome.error) {
      throw new Error(`Email send failed (status ${result.httpStatus ?? 'none'}) ${stoppedAt}`);
    }
    return sendFrom(index + 1, { ...tally, sent: tally.sent + 1 });
  };
  const { sent, refused } = await sendFrom(0, { sent: 0, refused: 0 });
  const counts = { sent, refused, alreadyHandled: handled.size };
  // Every address refused on a fresh list is more likely the request than the addresses.
  if (refused === remaining.length && handled.size === 0) {
    log.warn(counts, 'Post-submission email refused for every address');
    throw new JobCancelledError(`The provider refused every address (${refused})`);
  }
  if (refused > 0) log.warn(counts, 'Post-submission email sent; some addresses were refused');
  else log.info(counts, 'Post-submission email sent');
};
