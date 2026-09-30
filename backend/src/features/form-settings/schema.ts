import { extendZodWithOpenApi, type OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z, type ZodTypeAny } from 'zod';

extendZodWithOpenApi(z);

export const FormSettingsParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('FormSettings_FormIdParams');

const TAG = 'core.form-settings';
const NOT_FOUND = 'Form not found, or its settings are not available';

/** OpenAPI for a settings group's standard GET and PUT at /design/forms/{id}/settings/<key>. */
export const registerSettingsPaths = (
  registry: OpenAPIRegistry,
  input: { key: string; label: string; settingsSchema: ZodTypeAny; bodySchema: ZodTypeAny },
): void => {
  const path = `/design/forms/{id}/settings/${input.key}`;

  registry.registerPath({
    method: 'get',
    path,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: { params: FormSettingsParamsSchema },
    responses: {
      200: {
        description: `The form's ${input.label}`,
        content: { 'application/json': { schema: input.settingsSchema } },
      },
      403: { description: 'Requires form_read' },
      404: { description: NOT_FOUND },
    },
  });

  registry.registerPath({
    method: 'put',
    path,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: FormSettingsParamsSchema,
      body: { content: { 'application/json': { schema: input.bodySchema } } },
    },
    responses: {
      200: {
        description: `Updated ${input.label}`,
        content: { 'application/json': { schema: input.settingsSchema } },
      },
      400: { description: 'Validation or business rule error' },
      403: { description: 'Requires form_update' },
      404: { description: NOT_FOUND },
    },
  });
};
