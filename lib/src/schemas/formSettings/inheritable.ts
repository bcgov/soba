import { z } from 'zod';

/** A form's view of a settings group its workspace shares. `own` is null while the form inherits. */
export interface InheritableSettings<T> {
  inherit: boolean;
  own: T | null;
  workspace: T;
  effective: T;
}

/** A form either inherits, which drops its own values, or saves its own. */
export type SetInheritableSettingsBody<T> = { inherit: true } | { inherit: false; values: T };

/**
 * The schemas of a settings group whose values a workspace shares with its forms. A body that mixes
 * the two choices, such as inherit with values, is refused rather than half applied.
 */
export const inheritableSettingsSchemas = <T extends z.ZodType>(values: T) => ({
  /** A workspace's values, as read and as saved. */
  workspace: values,
  form: z.object({
    inherit: z.boolean(),
    own: values.nullable(),
    workspace: values,
    effective: values,
  }),
  formBody: z.discriminatedUnion('inherit', [
    z.strictObject({ inherit: z.literal(true) }),
    z.strictObject({ inherit: z.literal(false), values }),
  ]),
});
