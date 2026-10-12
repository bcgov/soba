import { z } from 'zod';
import { SubmitRefusal } from '../permissions/codes';
import { SubmitterFormSchema } from './forms';
import { MySubmissionRoleSchema } from './submissions';

export const SubmissionDataDocumentSchema = z
  .object({
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .catchall(z.unknown());
export type SubmissionDataDocument = z.infer<typeof SubmissionDataDocumentSchema>;

export const SubmitFillBundleSchema = z.object({
  formId: z.string(),
  workflowState: z.string(),
  formVersionId: z.string(),
  headRevisionId: z.string().nullable(),
  // The head revision's number, in append order over every revision.
  currentRevisionNo: z.number().int(),
  // The caller's active grant on the submission.
  role: MySubmissionRoleSchema,
  // The form and its facts for the caller, as My Forms lists it.
  form: SubmitterFormSchema,
  schema: z.record(z.string(), z.unknown()),
  content: SubmissionDataDocumentSchema.nullable(),
  // Deprecated: canWriteSubmission over role, workflowState and form gives the same answer.
  canWrite: z.boolean(),
  // Deprecated: canSaveDraftOnSubmission over role, workflowState and form gives the same answer.
  canSaveDraft: z.boolean(),
});
export type SubmitFillBundle = z.infer<typeof SubmitFillBundleSchema>;

/** Why submit mode refused a request; an error response carries it as `code`. */
export const SubmitRefusalCodeSchema = z.enum(SubmitRefusal);
