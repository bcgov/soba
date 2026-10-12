import { and, eq } from 'drizzle-orm';
import type { SubmissionAccessFacts, SubmitterFormFacts } from '@soba/lib';
import { db, type DbOrTx } from '../client';
import { PUBLIC_PROVIDER_CODE, SubmissionParticipantStatus } from '../codes';
import { formVersions, forms, submissionParticipants, submissions } from '../schema';
import { liveSubmission } from './liveRows';
import { formFacts } from './submitterFormRepo';

/** A live submission as the submit routes read it. */
export interface SubmitterSubmissionRow {
  id: string;
  workspaceId: string;
  formId: string;
  formVersionId: string;
  headRevisionId: string | null;
  currentRevisionNo: number;
  workflowState: string;
  engineSubmissionRef: string | null;
  /** The submission's own form version in the engine. */
  engineSchemaRef: string | null;
  formEngineCode: string;
}

/** A submission, the caller's standing on it, and its form's facts for the caller. */
export interface SubmitterSubmission {
  submission: SubmitterSubmissionRow;
  access: SubmissionAccessFacts;
  form: SubmitterFormFacts;
}

/**
 * Everything the submit routes decide on, in one statement: the submission, the caller's active
 * grant, and its form's facts. Null when the submission, its form or its version is deleted. The
 * public user's grant counts; its form permissions are not read, as it belongs to no workspace.
 */
export const findSubmitterSubmission = async (
  input: { submissionId: string; actorId: string; idpCode?: string | null },
  executor: DbOrTx = db,
): Promise<SubmitterSubmission | null> => {
  const userId = input.idpCode === PUBLIC_PROVIDER_CODE ? null : input.actorId;
  const facts = formFacts(userId, {
    formIds: db
      .select({ formId: submissions.formId })
      .from(submissions)
      .where(eq(submissions.id, input.submissionId)),
  });
  const [row] = await facts
    .join(
      executor
        .select({
          id: submissions.id,
          workspaceId: submissions.workspaceId,
          formId: submissions.formId,
          formVersionId: submissions.formVersionId,
          headRevisionId: submissions.headRevisionId,
          currentRevisionNo: submissions.currentRevisionNo,
          workflowState: submissions.workflowState,
          engineSubmissionRef: submissions.engineSubmissionRef,
          engineSchemaRef: formVersions.engineSchemaRef,
          formEngineCode: forms.formEngineCode,
          role: submissionParticipants.role,
          ...facts.columns,
        })
        .from(submissions)
        .innerJoin(forms, eq(forms.id, submissions.formId))
        .innerJoin(formVersions, eq(formVersions.id, submissions.formVersionId))
        .leftJoin(
          submissionParticipants,
          and(
            eq(submissionParticipants.submissionId, submissions.id),
            eq(submissionParticipants.userId, input.actorId),
            eq(submissionParticipants.status, SubmissionParticipantStatus.active),
          ),
        )
        .$dynamic(),
    )
    .where(and(eq(submissions.id, input.submissionId), liveSubmission))
    .limit(1);
  if (!row) return null;

  const {
    role,
    publishedVersionId,
    permissions,
    audienceMode,
    audienceIdps,
    allowSubmitterDrafts,
    ...submission
  } = row;
  return {
    submission,
    access: { role, workflowState: submission.workflowState },
    form: { publishedVersionId, permissions, audienceMode, audienceIdps, allowSubmitterDrafts },
  };
};
