import { randomUUID } from 'node:crypto';
import {
  SubmissionReviewSchema,
  type SubmissionReview,
  type UpdateSubmissionStatusBody,
} from '@soba/lib';
import reviewData from './reviewData.json';
import type { SubmissionsContextInput } from './serviceFactory';

// Placeholder methods, still to be replaced by a real service. Data comes from static
// reviewData.json; changes stay in memory until restart.
const sampleReview = SubmissionReviewSchema.parse(reviewData);
const reviews = new Map<string, SubmissionReview>();

const read = (submissionId: string): SubmissionReview => reviews.get(submissionId) ?? sampleReview;

const actorOf = (ctx: SubmissionsContextInput): string => ctx.actorDisplayLabel ?? ctx.actorId;

// Answers with a promise, as the real storage will.
function writeAsync(
  submissionId: string,
  change: Partial<SubmissionReview>,
): Promise<SubmissionReview> {
  const next = { ...read(submissionId), ...change };
  reviews.set(submissionId, next);
  return Promise.resolve(next);
}

export const submissionReviewService = {
  get: (_ctx: SubmissionsContextInput, submissionId: string) => Promise.resolve(read(submissionId)),

  updateStatus: (
    ctx: SubmissionsContextInput,
    submissionId: string,
    body: UpdateSubmissionStatusBody,
  ) =>
    writeAsync(submissionId, {
      statusHistory: [
        {
          id: randomUUID(),
          status: body.status,
          assignee: body.assignee,
          changedAt: new Date().toISOString(),
          updatedBy: actorOf(ctx),
        },
        ...read(submissionId).statusHistory,
      ],
    }),

  addNote: (ctx: SubmissionsContextInput, submissionId: string, text: string) =>
    writeAsync(submissionId, {
      notes: [
        { id: randomUUID(), text, createdAt: new Date().toISOString(), createdBy: actorOf(ctx) },
        ...read(submissionId).notes,
      ],
    }),

  /** Records that the answers were changed. The answers themselves are not written here. */
  recordEdit: (ctx: SubmissionsContextInput, submissionId: string) =>
    writeAsync(submissionId, {
      editHistory: [
        { id: randomUUID(), editedAt: new Date().toISOString(), editedBy: actorOf(ctx) },
        ...read(submissionId).editHistory,
      ],
    }),
};
