import type { SendEmail } from './NotificationAdapter';
import type { SendOutcome } from './sendOutcome';

/** One email send, as the notification service reported and audited it. */
export interface JobEmailResult extends SendOutcome {
  /** False when the audit row could not be written. */
  audited: boolean;
}

/** Where a job's sends stand. A run starts when the job is created, or at its last re-run. */
export interface HandledAddresses {
  /** Addresses already handed to the provider, or that the provider refused since the last re-run. */
  recipients: Set<string>;
  /** Any of the job's emails reached its address, in any run. */
  anySent: boolean;
}

/** Where the environment's email stands, read at one moment by the database clock. */
export interface EmailRoom {
  /** Emails it may still send today (`roomToday`). */
  room: number;
  /** Until the next midnight in NOTIFICATION_DAILY_RESET_TIME_ZONE, when the count starts again. */
  resetInMs: number;
  /** Until email may go again after the provider's limit (`limitPauseEnds`); null if it may now. */
  pauseLeftMs: number | null;
}

/**
 * The notification service bound to one job: each send carries the job's ids into the audit and is
 * attributed to whoever the job sends for.
 */
export interface JobNotifications {
  enabled(): Promise<boolean>;
  sendEmail(email: SendEmail): Promise<JobEmailResult>;
  /** Where this job's sends stand, from its audit rows. */
  handled(): Promise<HandledAddresses>;
  /** Where the environment's email stands: the day's room and any pause. */
  emailRoom(): Promise<EmailRoom>;
}
