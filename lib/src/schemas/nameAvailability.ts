import { z } from 'zod';

/**
 * The answer of a live name check: whether a name is free where the save it previews would put
 * it. Workspaces, forms, groups and roles all answer the same way.
 */
export const NameAvailabilityResponseSchema = z.object({
  available: z.boolean(),
});
export type NameAvailabilityResponse = z.infer<typeof NameAvailabilityResponseSchema>;
