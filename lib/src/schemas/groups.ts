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
