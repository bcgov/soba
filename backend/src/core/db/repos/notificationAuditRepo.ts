import { db } from '../client';
import { notificationAudits, type NotificationAuditRecipients } from '../schema';

export type NotificationAuditRecord = typeof notificationAudits.$inferSelect;

export interface NewNotificationAudit {
  workspaceId: string;
  formId?: string | null;
  submissionId?: string | null;
  pluginCode: string;
  channel: string;
  outcome: string;
  recipients: NotificationAuditRecipients;
  subject?: string | null;
  providerMessageId?: string | null;
  providerStatus?: string | null;
  httpStatus?: number | null;
  errorDetail?: string | null;
  durationMs: number;
  requestId?: string | null;
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
    createdBy: input.createdBy,
  });
};
