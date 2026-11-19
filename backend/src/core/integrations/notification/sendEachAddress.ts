import { EmailAddressSchema } from '@soba/lib';
import type { Logger } from 'pino';
import { NotificationOutcome } from '../../db/codes';
import { JobCancelledError } from '../../jobs/settlement';
import { DAILY_LIMIT_REACHED, deferUntilReset, PROVIDER_LIMIT_REACHED } from './dailyReset';
import type { JobNotifications } from './JobNotifications';
import type { SendEmail } from './NotificationAdapter';
import { isRefusedSend } from './sendOutcome';

export const NOTIFICATIONS_OFF = 'Notifications are off';

/** What a job sends with: its notifications, its stop signal and its log. */
export interface SendEachAddressContext {
  notifications: JobNotifications;
  signal: AbortSignal;
  log: Pick<Logger, 'info' | 'warn'>;
}

interface Tally {
  sent: number;
  refused: number;
}

const normalize = (address: string): string => address.trim().toLowerCase();

const isAddress = (address: string): boolean => EmailAddressSchema.safeParse(address).success;

/**
 * Sends to each address in turn; a failure other than a refusal stops the rest of the list, and the
 * provider's limit defers it to `resetsAt`.
 */
const sendInTurn = async (
  { notifications, signal }: SendEachAddressContext,
  addresses: readonly string[],
  content: SendEmail['content'],
  resetsAt: Date,
): Promise<Tally> => {
  const sendFrom = async (index: number, tally: Tally): Promise<Tally> => {
    if (index === addresses.length) return tally;
    signal.throwIfAborted();
    const result = await notifications.sendEmail({
      recipients: { to: [addresses[index]] },
      content,
    });
    // Where in the list it stopped: the retry skips the addresses before this one.
    const stoppedAt = `after ${index} of ${addresses.length}`;
    if (!result.audited) throw new Error(`A send was not recorded; stopping ${stoppedAt}`);
    if (result.outcome === NotificationOutcome.disabled) {
      throw new JobCancelledError(NOTIFICATIONS_OFF);
    }
    // The addresses before this one stay handled; this one and the rest go after the reset.
    if (result.outcome === NotificationOutcome.limited) {
      throw deferUntilReset(resetsAt, PROVIDER_LIMIT_REACHED);
    }
    if (isRefusedSend(result)) return sendFrom(index + 1, { ...tally, refused: tally.refused + 1 });
    if (result.outcome === NotificationOutcome.error) {
      throw new Error(`Email send failed (status ${result.httpStatus ?? 'none'}) ${stoppedAt}`);
    }
    return sendFrom(index + 1, { ...tally, sent: tally.sent + 1 });
  };
  return sendFrom(0, { sent: 0, refused: 0 });
};

/**
 * Sends one email per address, each address once and in lower case, skipping those already handled
 * for this job. An address no provider would take, or one the provider refuses, is counted as
 * refused and skipped; a list on which no email has reached anyone, on any attempt, ends cancelled.
 * It sends no more than the environment may still send today and defers the rest, without using an
 * attempt, until the daily reset, as it does when the provider refuses a send at its own limit. Any
 * other failure, a missing audit row or an abort stops the run and throws, so
 * the job retries and the retry skips what was handled. Logs counts only, never addresses.
 */
export const sendEachAddress = async (
  context: SendEachAddressContext,
  addresses: readonly string[],
  content: SendEmail['content'],
): Promise<void> => {
  const { notifications, log } = context;
  const unique = [...new Set(addresses.map(normalize))];
  if (unique.length === 0) return;
  const valid = unique.filter(isAddress);
  const invalid = unique.length - valid.length;
  const { recipients, anySent } = await notifications.handled();
  const handled = new Set([...recipients].map(normalize));
  const remaining = valid.filter((address) => !handled.has(address));
  if (remaining.length === 0 && invalid === 0 && anySent) return;

  let tally: Tally = { sent: 0, refused: 0 };
  if (remaining.length > 0) {
    if (!(await notifications.enabled())) throw new JobCancelledError(NOTIFICATIONS_OFF);
    // One reading of the day for the whole attempt, so every wait in it is for the same reset.
    const { room, resetsAt } = await notifications.dailyRoom();
    if (room === 0) throw deferUntilReset(resetsAt, DAILY_LIMIT_REACHED);
    tally = await sendInTurn(context, remaining.slice(0, room), content, resetsAt);
    const waiting = remaining.length - room;
    if (waiting > 0) {
      log.info(
        {
          sent: tally.sent,
          refused: tally.refused + invalid,
          alreadyHandled: handled.size,
          waiting,
        },
        'Emails sent; the rest wait for the daily reset',
      );
      throw deferUntilReset(resetsAt, DAILY_LIMIT_REACHED);
    }
  }
  const refused = tally.refused + invalid;
  const counts = { sent: tally.sent, refused, alreadyHandled: handled.size };
  // With nothing sent, on this attempt or an earlier one, the rest were refused before: every
  // address was refused, which is more likely the request than the addresses.
  if (tally.sent === 0 && !anySent) {
    log.warn(counts, 'Every address was refused');
    throw new JobCancelledError(`Every address was refused (${unique.length})`);
  }
  if (refused > 0) log.warn(counts, 'Emails sent; some addresses were refused');
  else log.info(counts, 'Emails sent');
};
