import { NotificationOutcome, type NotificationOutcomeCode } from '../../db/codes';

/** One send as the notification service reports and audits it. */
export interface SendOutcome {
  outcome: NotificationOutcomeCode;
  httpStatus: number | null;
}

/**
 * Statuses with which the provider refuses an address, as the Notify test safelist does: sending
 * it again would be refused again. Any other error status is the provider or its gateway.
 */
export const REFUSED_HTTP_STATUSES: readonly number[] = [400, 422];

export const isRefusedSend = ({ outcome, httpStatus }: SendOutcome): boolean =>
  outcome === NotificationOutcome.error &&
  httpStatus !== null &&
  REFUSED_HTTP_STATUSES.includes(httpStatus);

/** A send that went out, as far as we know: handed to the provider, or sent nowhere by design. */
export const isSentSend = ({ outcome }: SendOutcome): boolean =>
  outcome === NotificationOutcome.accepted || outcome === NotificationOutcome.not_sent;

/** A send that needs no retry: handed to the provider, sent nowhere by design, or refused. */
export const isHandledSend = (send: SendOutcome): boolean =>
  isSentSend(send) || isRefusedSend(send);

/**
 * A send that leaves its address handled for a job's current run, queued at `runQueuedAt`. A refusal
 * counts only within the run, so a re-run tries a refused address again, such as one added to the
 * provider's safelist since.
 */
export const isHandledForRun = (
  send: SendOutcome & { createdAt: Date },
  runQueuedAt: Date,
): boolean => isHandledSend(send) && !(isRefusedSend(send) && send.createdAt < runQueuedAt);

/** Whether a job's current run, queued at `runQueuedAt`, has handled an address yet. */
export const hasRunStarted = (
  sends: readonly (SendOutcome & { createdAt: Date })[],
  runQueuedAt: Date,
): boolean => sends.some((send) => isHandledSend(send) && send.createdAt >= runQueuedAt);
