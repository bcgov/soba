import { EmailAddressSchema } from '@soba/lib';
import type { Logger } from 'pino';
import { NotificationOutcome } from '../../db/codes';
import { JobCancelledError, type JobDeferredError } from '../../jobs/errors';
import { deferUntilPauseEnds, deferUntilReset } from './emailBudget';
import type { EmailRoom, JobNotifications } from './JobNotifications';
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
  /** Set when the rest wait. */
  deferral?: JobDeferredError;
}

const normalize = (address: string): string => address.trim().toLowerCase();

const isAddress = (address: string): boolean => EmailAddressSchema.safeParse(address).success;

/** The wait the room calls for: until the provider's pause ends, or the reset when none is left. */
const waitFor = ({ room, resetInMs, pauseLeftMs }: EmailRoom): JobDeferredError | null => {
  if (pauseLeftMs !== null) return deferUntilPauseEnds(pauseLeftMs);
  if (room === 0) return deferUntilReset(resetInMs);
  return null;
};

/** Sends to each address in turn, reading the room before each send (see `sendEachAddress`). */
const sendInTurn = async (
  { notifications, signal }: SendEachAddressContext,
  addresses: readonly string[],
  content: SendEmail['content'],
): Promise<Tally> => {
  const sendFrom = async (index: number, tally: Tally): Promise<Tally> => {
    if (index === addresses.length) return tally;
    signal.throwIfAborted();
    const wait = waitFor(await notifications.emailRoom());
    // A stop that came during the read: another worker may hold the job now.
    signal.throwIfAborted();
    if (wait) return { ...tally, deferral: wait };
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
    // The addresses before this one stay handled; this one and the rest wait out the pause, which
    // the audited refusal starts or lengthens for every email job.
    if (result.outcome === NotificationOutcome.limited) {
      const after = await notifications.emailRoom();
      return { ...tally, deferral: deferUntilPauseEnds(after.pauseLeftMs) };
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
 * Throws as `sendEachAddress` would before its first send: `JobCancelledError` while notifications
 * are off, and a `JobDeferredError`, which uses no attempt, while there is no room today or the
 * provider's pause lasts.
 */
export const assertCanSend = async ({
  notifications,
  signal,
}: Pick<SendEachAddressContext, 'notifications' | 'signal'>): Promise<void> => {
  if (!(await notifications.enabled())) throw new JobCancelledError(NOTIFICATIONS_OFF);
  const wait = waitFor(await notifications.emailRoom());
  signal.throwIfAborted();
  if (wait) throw wait;
};

/**
 * Sends one email per address, each address once and in lower case, skipping those already handled
 * for this job. An address no provider would take, or one the provider refuses, is counted as
 * refused and skipped; a list on which no email has reached anyone, on any attempt, ends cancelled.
 * It reads the room before each send, so jobs sending at the same time share it: it sends no more
 * than the environment may still send today (see `roomToday`) and defers the rest, without using an
 * attempt, until the daily reset; after the provider refuses a send at its limit, every email job
 * defers until the pause ends (see `limitPauseEnds`). Any other failure, a missing
 * audit row or an abort stops the run and throws, so the job retries and the retry skips what was
 * handled. Logs counts only, never addresses.
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
    tally = await sendInTurn(context, remaining, content);
    if (tally.deferral) {
      if (tally.sent + tally.refused > 0) {
        log.info(
          {
            sent: tally.sent,
            refused: tally.refused + invalid,
            alreadyHandled: handled.size,
            waiting: remaining.length - tally.sent - tally.refused,
            waitingFor: tally.deferral.message,
          },
          'Emails sent; the rest wait',
        );
      }
      throw tally.deferral;
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
