import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const ActionParamsSchema = z
  .object({
    id: z.string().min(1),
    code: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .openapi('PostSubmission_ActionParams');

export const ActionValuesSchema = z
  .strictObject({
    enabled: z.boolean(),
    /** Checked against the action plugin's own schema, unless the action is off and has none. */
    options: z.record(z.string(), z.unknown()),
  })
  .openapi('PostSubmission_ActionValues');

/** 0 for a scope with no saved row yet; the first save names it. */
const VersionSchema = z.number().int().nonnegative();

export const SetWorkspaceActionBodySchema = z
  .strictObject({ values: ActionValuesSchema, version: VersionSchema })
  .openapi('PostSubmission_SetWorkspaceActionBody');

export const SetFormActionBodySchema = z
  .discriminatedUnion('inherit', [
    z.strictObject({ inherit: z.literal(true), version: VersionSchema }),
    z.strictObject({
      inherit: z.literal(false),
      values: ActionValuesSchema,
      version: VersionSchema,
    }),
  ])
  .openapi('PostSubmission_SetFormActionBody');

export const WorkspaceActionSettingsSchema = z
  .object({ values: ActionValuesSchema, version: VersionSchema })
  .openapi('PostSubmission_WorkspaceActionSettings');

export const FormActionSettingsSchema = z
  .object({
    inherit: z.boolean(),
    workspace: ActionValuesSchema,
    own: ActionValuesSchema.nullable().openapi({ description: 'Null while the form inherits.' }),
    effective: ActionValuesSchema,
    version: VersionSchema,
  })
  .openapi('PostSubmission_FormActionSettings');

const actionList = (settings: z.ZodType, name: string) =>
  z
    .object({
      actions: z.array(
        z.object({
          code: z.string(),
          name: z.string(),
          description: z.string().optional(),
          scopes: z.array(z.enum(['workspace', 'form'])),
          settings,
        }),
      ),
    })
    .openapi(name);

export const FormActionListSchema = actionList(
  FormActionSettingsSchema,
  'PostSubmission_FormActionList',
);
export const WorkspaceActionListSchema = actionList(
  WorkspaceActionSettingsSchema,
  'PostSubmission_WorkspaceActionList',
);

export type SetWorkspaceActionBody = z.infer<typeof SetWorkspaceActionBodySchema>;
export type SetFormActionBody = z.infer<typeof SetFormActionBodySchema>;
