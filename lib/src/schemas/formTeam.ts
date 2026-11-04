import { z } from 'zod';
import { OffsetPageSchema } from './pagination';

/** A group a form team member can be assigned to: one of the workspace's active groups. */
export const TeamGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type TeamGroup = z.infer<typeof TeamGroupSchema>;

/**
 * A person on a form's team: a workspace member in at least one group on the form. `id` is their
 * workspace membership. Their groups are the ones in effect on this form: the workspace group's
 * members, adjusted by what the form adds and takes out.
 */
export const TeamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  /** Ids of the groups the member belongs to on this form. */
  groups: z.array(z.string()),
  /** Of `groups`, those the member is in through this form alone, not the workspace group. */
  formOnlyGroups: z.array(z.string()),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

/** The form's team, by name. */
export const FormTeamResponseSchema = z.object({
  items: z.array(TeamMemberSchema),
  page: OffsetPageSchema,
  filters: z.object({ q: z.string().optional() }),
});
export type FormTeamResponse = z.infer<typeof FormTeamResponseSchema>;

/** The groups a form's team members can be put in. */
export const FormTeamGroupsSchema = z.object({ items: z.array(TeamGroupSchema) });
export type FormTeamGroups = z.infer<typeof FormTeamGroupsSchema>;

/** Puts a person on the form's team, in at least one group; on this form only. */
export const AddFormTeamMemberBodySchema = z.object({
  userId: z.uuid(),
  groupIds: z.array(z.uuid()).min(1),
});
export type AddFormTeamMemberBody = z.infer<typeof AddFormTeamMemberBodySchema>;

/** A team member's groups on this form; removing them from the team is a delete. */
export const SetFormTeamGroupsBodySchema = z.object({
  groupIds: z.array(z.uuid()).min(1),
});
export type SetFormTeamGroupsBody = z.infer<typeof SetFormTeamGroupsBodySchema>;
