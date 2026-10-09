import { z } from 'zod';

export const SUBMISSION_REVIEW_STATUSES = [
  'SUBMITTED',
  'ASSIGNED',
  'REVISING',
  'COMPLETED',
] as const;
export const SubmissionReviewStatusSchema = z.enum(SUBMISSION_REVIEW_STATUSES);
export type SubmissionReviewStatus = z.infer<typeof SubmissionReviewStatusSchema>;

export const SubmissionStatusChangeSchema = z.object({
  id: z.string(),
  status: SubmissionReviewStatusSchema,
  assignee: z.string().nullable(),
  changedAt: z.string(),
  updatedBy: z.string(),
});
export type SubmissionStatusChange = z.infer<typeof SubmissionStatusChangeSchema>;

export const SubmissionNoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
});
export type SubmissionNote = z.infer<typeof SubmissionNoteSchema>;

export const SubmissionEditSchema = z.object({
  id: z.string(),
  editedAt: z.string(),
  editedBy: z.string(),
});
export type SubmissionEdit = z.infer<typeof SubmissionEditSchema>;

/** Newest first throughout; the current status and assignee are `statusHistory[0]`. */
export const SubmissionReviewSchema = z.object({
  assignees: z.array(z.string()),
  statusHistory: z.array(SubmissionStatusChangeSchema).min(1),
  notes: z.array(SubmissionNoteSchema),
  editHistory: z.array(SubmissionEditSchema),
});
export type SubmissionReview = z.infer<typeof SubmissionReviewSchema>;

export const UpdateSubmissionStatusBodySchema = z.object({
  status: SubmissionReviewStatusSchema,
  assignee: z.string().trim().min(1).nullable(),
});
export type UpdateSubmissionStatusBody = z.infer<typeof UpdateSubmissionStatusBodySchema>;

export const AddSubmissionNoteBodySchema = z.object({
  text: z.string().trim().min(1),
});
export type AddSubmissionNoteBody = z.infer<typeof AddSubmissionNoteBodySchema>;
