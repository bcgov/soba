import { db } from '../client';
import { documentGenerationAudits } from '../schema';

export type DocumentGenerationAuditRecord = typeof documentGenerationAudits.$inferSelect;

export interface NewDocumentGenerationAudit {
  workspaceId: string;
  formId: string;
  submissionId: string;
  mode: string;
  backendCode: string;
  outcome: string;
  httpStatus?: number | null;
  durationMs: number;
  errorDetail?: string | null;
  requestId?: string | null;
  createdBy: string;
}

export const createDocumentGenerationAudit = async (
  input: NewDocumentGenerationAudit,
): Promise<void> => {
  await db.insert(documentGenerationAudits).values({
    workspaceId: input.workspaceId,
    formId: input.formId,
    submissionId: input.submissionId,
    mode: input.mode,
    backendCode: input.backendCode,
    outcome: input.outcome,
    httpStatus: input.httpStatus ?? null,
    durationMs: input.durationMs,
    errorDetail: input.errorDetail ?? null,
    requestId: input.requestId ?? null,
    createdBy: input.createdBy,
  });
};
