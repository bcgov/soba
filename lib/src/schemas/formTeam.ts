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

/** An active Soba user who is not yet on the form team. */
export const TeamCandidateSchema = TeamMemberSchema.omit({ groups: true }).extend({
  membershipId: z.string().uuid().nullable(),
});
export type TeamCandidate = z.infer<typeof TeamCandidateSchema>;
