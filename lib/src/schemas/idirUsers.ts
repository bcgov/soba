import { z } from 'zod';

const searchField = z.string().trim().min(1).max(254);
export const IdirUserSearchSchema = z
  .object({
    email: searchField.optional(),
    firstName: searchField.optional(),
    lastName: searchField.optional(),
    guid: searchField.optional(),
  })
  .strict()
  .refine((value) => [value.email, value.firstName, value.lastName, value.guid].some(Boolean), {
    message: 'Provide at least one IDIR search field',
  });

// CSS user records can include provider-specific attributes alongside these profile fields.
export const IdirUserSchema = z
  .object({
    username: z.string(),
    email: z.string().nullish(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
export const IdirUserSearchResponseSchema = z.object({ users: z.array(IdirUserSchema) });
export type IdirUserSearch = z.infer<typeof IdirUserSearchSchema>;
export type IdirUser = z.infer<typeof IdirUserSchema>;
export type IdirUserSearchResponse = z.infer<typeof IdirUserSearchResponseSchema>;

/** Workspace context is used for authorization and is never forwarded to CSS. */
export const IdirUserSearchQuerySchema = IdirUserSearchSchema.safeExtend({
  workspaceId: z.string().trim().min(1),
});
export type IdirUserSearchQuery = z.infer<typeof IdirUserSearchQuerySchema>;
