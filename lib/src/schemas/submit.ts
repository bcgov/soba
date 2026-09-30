import { z } from 'zod';

export const SubmissionDataDocumentSchema = z
  .object({
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .catchall(z.unknown());
export type SubmissionDataDocument = z.infer<typeof SubmissionDataDocumentSchema>;

export const SubmitFillBundleSchema = z.object({
  workflowState: z.string(),
  formVersionId: z.string(),
  headRevisionId: z.string().nullable(),
  schema: z.record(z.string(), z.unknown()),
  content: SubmissionDataDocumentSchema.nullable(),
  // Whether the caller may edit and submit; a participant outside the audience only views.
  canWrite: z.boolean(),
  // Whether the caller may save a draft: canWrite, allowSubmitterDrafts on, and a non-public audience.
  canSaveDraft: z.boolean(),
});
export type SubmitFillBundle = z.infer<typeof SubmitFillBundleSchema>;
