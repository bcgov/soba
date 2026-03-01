import { z } from 'zod';

/** Payload for form_version outbox events (topic form_engine.{engineCode}.form_version.create) */
export const FormVersionCreatePayloadSchema = z.object({
  formVersionId: z.string().uuid(),
  engineCode: z.string().min(1),
  formId: z.string().uuid().optional(),
});
export type FormVersionCreatePayload = z.infer<typeof FormVersionCreatePayloadSchema>;

/** Payload for submission outbox events (topic form_engine.{engineCode}.submission.create) */
export const SubmissionCreatePayloadSchema = z.object({
  submissionId: z.string().uuid(),
  engineCode: z.string().min(1),
  formVersionId: z.string().uuid().optional(),
});
export type SubmissionCreatePayload = z.infer<typeof SubmissionCreatePayloadSchema>;

export function parseFormVersionCreatePayload(payload: unknown): FormVersionCreatePayload {
  return FormVersionCreatePayloadSchema.parse(payload);
}

export function parseSubmissionCreatePayload(payload: unknown): SubmissionCreatePayload {
  return SubmissionCreatePayloadSchema.parse(payload);
}
