import { and, count, eq, gte, inArray, or } from 'drizzle-orm';
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

/**
 * The environment's sends since `since` that the provider dealt with: accepted, or refused with one
 * of `refusedStatuses`. Failures to be retried and sends refused at a limit are not counted.
 */
export const countNotificationSendsSince = async (
  since: Date,
  refusedStatuses: readonly number[],
): Promise<number> => {
  const [row] = await db
    .select({ total: count() })
    .from(notificationAudits)
    .where(
      and(
        or(
          eq(notificationAudits.outcome, NotificationOutcome.accepted),
          and(
            eq(notificationAudits.outcome, NotificationOutcome.error),
            inArray(notificationAudits.httpStatus, [...refusedStatuses]),
          ),
        ),
        gte(notificationAudits.createdAt, since),
      ),
    );
  return row?.total ?? 0;
};
