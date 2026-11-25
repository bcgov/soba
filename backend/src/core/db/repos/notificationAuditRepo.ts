import { and, eq, gte, inArray, or, sql, type SQL } from 'drizzle-orm';
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core';
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

const acceptedSends = alias(notificationAudits, 'accepted_send');

/** When a send's request started: its row is written once the provider answers. */
const startedAt = (sends: { createdAt: AnyPgColumn; durationMs: AnyPgColumn }): SQL =>
  sql`${sends.createdAt} - ${sends.durationMs} * interval '1 millisecond'`;

/** The environment's emails, by the database clock, which also stamps each send. */
export interface EmailDay {
  /** The database clock when it was read. */
  now: Date;
  /** Sends since the day began that the provider dealt with: accepted, or refused for the address. */
  counted: number;
  /** When the next day begins. */
  resetsAt: Date;
  /** The provider's last refusal at its limit within the last day; null when there was none. */
  lastLimitedAt: Date | null;
  /**
   * The clock minutes within the last day with a refusal at the provider's limit, among sends
   * started after the last accepted one started; refusals in the same minute count once.
   */
  limitedInARow: number;
}

/**
 * The environment's emails: those since the last midnight in `timeZone` that count against the
 * day, accepted or refused with one of `refusedStatuses`, and the provider's latest refusals at its
 * limit. Failures to be retried are not counted. Reads back a day, or to midnight on a longer day,
 * so a run of refusals keeps its count across midnight.
 */
export const readEmailDay = async (
  timeZone: string,
  refusedStatuses: readonly number[],
): Promise<EmailDay> => {
  const localDay = sql`date_trunc('day', now() at time zone ${timeZone})`;
  const dayStart = sql`${localDay} at time zone ${timeZone}`;
  const since = sql`least(${dayStart}, now() - interval '1 day')`;
  const dealtWith = or(
    eq(notificationAudits.outcome, NotificationOutcome.accepted),
    and(
      eq(notificationAudits.outcome, NotificationOutcome.error),
      inArray(notificationAudits.httpStatus, [...refusedStatuses]),
    ),
  );
  const limited = eq(notificationAudits.outcome, NotificationOutcome.limited);
  const lastAcceptedStart = db
    .select({ at: sql`max(${startedAt(acceptedSends)})` })
    .from(acceptedSends)
    .where(
      and(
        eq(acceptedSends.outcome, NotificationOutcome.accepted),
        gte(acceptedSends.createdAt, since),
      ),
    );
  const inARow = sql`${limited} and ${startedAt(notificationAudits)} > coalesce((${lastAcceptedStart}), '-infinity'::timestamptz)`;
  const [row] = await db
    .select({
      now: sql<Date>`now()`.mapWith(notificationAudits.createdAt),
      counted: sql<number>`(count(*) filter (where ${notificationAudits.createdAt} >= ${dayStart} and ${dealtWith}))::int`,
      resetsAt: sql<Date>`(${localDay} + interval '1 day') at time zone ${timeZone}`.mapWith(
        notificationAudits.createdAt,
      ),
      lastLimitedAt:
        sql<Date | null>`max(${notificationAudits.createdAt}) filter (where ${limited})`.mapWith(
          notificationAudits.createdAt,
        ),
      limitedInARow: sql<number>`(count(distinct date_trunc('minute', ${notificationAudits.createdAt})) filter (where ${inARow}))::int`,
    })
    .from(notificationAudits)
    .where(gte(notificationAudits.createdAt, since));
  if (!row) throw new Error('The email day read returned no row');
  return row;
};
