import { z } from 'zod';

/** URL segment of the group, shared by the route, the SWR key and the OpenAPI component names. */
export const SUBMITTER_SETTINGS_KEY = 'submitter';

/** What a form's submitters may do. */
export const SubmitterSettingsSchema = z.object({
  allowSubmitterDrafts: z.boolean(),
});

/** A save sends every setting in the group. */
export const SetSubmitterSettingsBodySchema = SubmitterSettingsSchema;

export type SubmitterSettings = z.infer<typeof SubmitterSettingsSchema>;
export type SetSubmitterSettingsBody = z.infer<typeof SetSubmitterSettingsBodySchema>;
