import { z } from 'zod';

/** A group a form team member can be assigned to. */
export const TeamGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type TeamGroup = z.infer<typeof TeamGroupSchema>;

export const TeamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  /** Ids of the groups the member belongs to. */
  groups: z.array(z.string()),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

/** A user found by the add-member search. */
export const UserSearchResultSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  identityProvider: z.string(),
  /** Already on the form's team. They cannot be added again; their groups change through Edit. */
  onTeam: z.boolean(),
});
export type UserSearchResult = z.infer<typeof UserSearchResultSchema>;
