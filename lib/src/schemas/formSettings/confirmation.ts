import { z } from 'zod';
import {
  inheritableSettingsSchemas,
  type InheritableSettings,
  type SetInheritableSettingsBody,
  type WorkspaceSettings,
} from './inheritable';

/** URL segment of the group, shared by the routes, the SWR keys and the OpenAPI component names. */
export const CONFIRMATION_SETTINGS_KEY = 'confirmation';

/** What the confirmation screen offers a submitter. A save sends every setting in the group. */
export const ConfirmationSettingsSchema = z.object({
  allowSubmitterEmailCopy: z.boolean(),
});
export type ConfirmationSettings = z.infer<typeof ConfirmationSettingsSchema>;

const schemas = inheritableSettingsSchemas(ConfirmationSettingsSchema);

/** A workspace's confirmation settings, as read and as saved. */
export const WorkspaceConfirmationSettingsSchema = schemas.workspace;
export const FormConfirmationSettingsSchema = schemas.form;
export const SetFormConfirmationSettingsBodySchema = schemas.formBody;

export type WorkspaceConfirmationSettings = WorkspaceSettings<ConfirmationSettings>;
export type FormConfirmationSettings = InheritableSettings<ConfirmationSettings>;
export type SetFormConfirmationSettingsBody = SetInheritableSettingsBody<ConfirmationSettings>;
