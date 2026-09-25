import { z } from 'zod';

export const SetSubmitterAudienceBodySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('public') }),
  z.object({ mode: z.literal('protected'), idps: z.array(z.string().trim().min(1)).max(20) }),
]);
export type SetSubmitterAudienceBody = z.infer<typeof SetSubmitterAudienceBodySchema>;

export const SubmitterAudienceSchema = z.object({
  mode: z.enum(['public', 'protected', 'none']),
  idps: z.array(z.string()),
  users: z.array(z.object({ membershipId: z.string(), displayLabel: z.string().nullable() })),
  available: z.array(z.object({ code: z.string(), name: z.string() })),
});
export type SubmitterAudience = z.infer<typeof SubmitterAudienceSchema>;

export const SetFormSubmitterAudienceBodySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('inherit') }),
  z.object({ mode: z.literal('public') }),
  z.object({
    mode: z.literal('protected'),
    idps: z.array(z.string().trim().min(1)).min(1).max(20),
  }),
]);
export type SetFormSubmitterAudienceBody = z.infer<typeof SetFormSubmitterAudienceBodySchema>;

export const FormSubmitterAudienceSchema = z.object({
  inherit: z.boolean(),
  mode: SubmitterAudienceSchema.shape.mode,
  idps: z.array(z.string()),
  available: SubmitterAudienceSchema.shape.available,
  workspace: SubmitterAudienceSchema.pick({ mode: true, idps: true, users: true }),
});
export type FormSubmitterAudience = z.infer<typeof FormSubmitterAudienceSchema>;
