import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { submissionParticipants } from '../schema';
import { SubmissionParticipantStatus } from '../codes';

/** Whether the user holds an active grant (any role) on the submission. */
export const isActiveParticipant = async (
  submissionId: string,
  userId: string,
): Promise<boolean> => {
  const rows = await db
    .select({ id: submissionParticipants.id })
    .from(submissionParticipants)
    .where(
      and(
        eq(submissionParticipants.submissionId, submissionId),
        eq(submissionParticipants.userId, userId),
        eq(submissionParticipants.status, SubmissionParticipantStatus.active),
      ),
    )
    .limit(1);
  return rows.length > 0;
};
