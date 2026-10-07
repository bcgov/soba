import { randomUUID } from 'node:crypto';
import {
  SubmissionReviewSchema,
  type SubmissionReview,
  type UpdateSubmissionStatusBody,
} from '@soba/lib';
import reviewData from './reviewData.json';
import type { SubmissionsContextInput } from './serviceFactory';

// TODO:  Implement real service methods
// These are Placeholder  methods. Data comes from static reviewData.json
// changes stay in memory until restart.
const sampleReview = SubmissionReviewSchema.parse(reviewData);
const reviews = new Map<string, SubmissionReview>();

const read = (submissionId: string): SubmissionReview => reviews.get(submissionId) ?? sampleReview;

const actorOf = (ctx: SubmissionsContextInput): string => ctx.actorDisplayLabel ?? ctx.actorId;

function write(submissionId: string, change: Partial<SubmissionReview>): SubmissionReview {
  const next = { ...read(submissionId), ...change };
  reviews.set(submissionId, next);
  return next;
}

export const submissionReviewService = {
  get: async (_ctx: SubmissionsContextInput, submissionId: string) => read(submissionId),

  updateStatus: async (
    ctx: SubmissionsContextInput,
    submissionId: string,
    body: UpdateSubmissionStatusBody,
  ) =>
    write(submissionId, {
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

  addNote: async (ctx: SubmissionsContextInput, submissionId: string, text: string) =>
    write(submissionId, {
      notes: [
        { id: randomUUID(), text, createdAt: new Date().toISOString(), createdBy: actorOf(ctx) },
        ...read(submissionId).notes,
      ],
    }),

  /** Records that the answers were changed. The answers themselves are not written here. */
  recordEdit: async (ctx: SubmissionsContextInput, submissionId: string) =>
    write(submissionId, {
      editHistory: [
        { id: randomUUID(), editedAt: new Date().toISOString(), editedBy: actorOf(ctx) },
        ...read(submissionId).editHistory,
      ],
    }),
};
