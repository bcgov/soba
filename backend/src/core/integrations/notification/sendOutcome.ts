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

/** A send that needs no retry: handed to the provider, sent nowhere by design, or refused. */
export const isHandledSend = (send: SendOutcome): boolean =>
  send.outcome === NotificationOutcome.accepted ||
  send.outcome === NotificationOutcome.not_sent ||
  isRefusedSend(send);
