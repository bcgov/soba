import { and, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { NotificationOutcome, type NotificationOutcomeCode } from '../codes';
import { notificationAudits, type NotificationAuditRecipients } from '../schema';

export type NotificationAuditRecord = typeof notificationAudits.$inferSelect;

export interface NewNotificationAudit {
  workspaceId: string;
  formId?: string | null;
  submissionId?: string | null;
  pluginCode: string;
  channel: string;
  outcome: NotificationOutcomeCode;
  recipients: NotificationAuditRecipients;
  subject?: string | null;
  providerMessageId?: string | null;
  providerStatus?: string | null;
  httpStatus?: number | null;
  errorDetail?: string | null;
  durationMs: number;
  requestId?: string | null;
  jobId?: string | null;
  createdBy: string;
}

export const createNotificationAudit = async (input: NewNotificationAudit): Promise<void> => {
  await db.insert(notificationAudits).values({
    workspaceId: input.workspaceId,
    formId: input.formId ?? null,
    submissionId: input.submissionId ?? null,
    pluginCode: input.pluginCode,
    channel: input.channel,
    outcome: input.outcome,
    recipients: input.recipients,
    subject: input.subject ?? null,
    providerMessageId: input.providerMessageId ?? null,
    providerStatus: input.providerStatus ?? null,
    httpStatus: input.httpStatus ?? null,
    errorDetail: input.errorDetail ?? null,
    durationMs: input.durationMs,
    requestId: input.requestId ?? null,
    jobId: input.jobId ?? null,
    createdBy: input.createdBy,
  });
};

/** One audited send of a job: its outcome, who it went to, and when. */
export interface JobNotificationSend {
  outcome: NotificationOutcomeCode;
  httpStatus: number | null;
  recipients: NotificationAuditRecipients;
  createdAt: Date;
}

export const listJobNotificationSends = (jobId: string): Promise<JobNotificationSend[]> =>
  db
    .select({
      outcome: notificationAudits.outcome,
      httpStatus: notificationAudits.httpStatus,
      recipients: notificationAudits.recipients,
      createdAt: notificationAudits.createdAt,
    })
    .from(notificationAudits)
    .where(eq(notificationAudits.jobId, jobId));

/** The environment's emails today, by the database clock. */
export interface EmailDay {
  /** Sends the provider dealt with: accepted, or refused for the address. */
  counted: number;
  /** The provider refused a send at its limit. */
  limited: boolean;
  /** When the next day begins. */
  resetsAt: Date;
}

/**
 * The environment's emails since the last midnight in `timeZone`, by the database clock, which
 * also stamps each send. It counts those accepted and those refused with one of
 * `refusedStatuses`; failures to be retried and sends refused at a limit are not counted.
 */
export const readEmailDay = async (
  timeZone: string,
  refusedStatuses: readonly number[],
): Promise<EmailDay> => {
  const localDay = sql`date_trunc('day', now() at time zone ${timeZone})`;
  const dealtWith = or(
    eq(notificationAudits.outcome, NotificationOutcome.accepted),
    and(
      eq(notificationAudits.outcome, NotificationOutcome.error),
      inArray(notificationAudits.httpStatus, [...refusedStatuses]),
    ),
  );
  const [row] = await db
    .select({
      counted: sql<number>`(count(*) filter (where ${dealtWith}))::int`,
      limited: sql<boolean>`coalesce(bool_or(${eq(notificationAudits.outcome, NotificationOutcome.limited)}), false)`,
      resetsAt: sql<Date>`(${localDay} + interval '1 day') at time zone ${timeZone}`.mapWith(
        notificationAudits.createdAt,
      ),
    })
    .from(notificationAudits)
    .where(gte(notificationAudits.createdAt, sql`${localDay} at time zone ${timeZone}`));
  if (!row) throw new Error('The email day read returned no row');
  return row;
};
