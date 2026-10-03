import { extendZodWithOpenApi, type OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z, type ZodTypeAny } from 'zod';
import type { SettingsScope } from './routes';

extendZodWithOpenApi(z);

export const FormSettingsParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('FormSettings_FormIdParams');

export const WorkspaceSettingsParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .openapi('FormSettings_WorkspaceIdParams');

const TAG = 'core.form-settings';

const SCOPE_DOCS: Record<
  SettingsScope,
  {
    path: string;
    params: typeof FormSettingsParamsSchema;
    owner: string;
    read403: string;
    write403: string;
    notFound: string;
  }
> = {
  form: {
    path: '/design/forms/{id}/settings',
    params: FormSettingsParamsSchema,
    owner: "The form's",
    read403: 'Requires form_read',
    write403: 'Requires form_update',
    notFound: 'Form not found, or its settings are not available',
  },
  workspace: {
    path: '/workspaces/{id}/settings',
    params: WorkspaceSettingsParamsSchema,
    owner: "The workspace's",
    read403: 'Actor is not a member of the workspace',
    write403: 'Workspace management requires an owner or admin role',
    notFound: 'Workspace not found, or its settings are not available',
  },
};

/** OpenAPI for a settings group's standard GET and PUT at one scope. */
export const registerSettingsPaths = (
  registry: OpenAPIRegistry,
  input: {
    key: string;
    label: string;
    settingsSchema: ZodTypeAny;
    bodySchema: ZodTypeAny;
    scope?: SettingsScope;
  },
): void => {
  const docs = SCOPE_DOCS[input.scope ?? 'form'];
  const path = `${docs.path}/${input.key}`;

  registry.registerPath({
    method: 'get',
    path,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: { params: docs.params },
    responses: {
      200: {
        description: `${docs.owner} ${input.label}`,
        content: { 'application/json': { schema: input.settingsSchema } },
      },
      403: { description: docs.read403 },
      404: { description: docs.notFound },
    },
  });

  registry.registerPath({
    method: 'put',
    path,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: docs.params,
      body: { content: { 'application/json': { schema: input.bodySchema } } },
    },
    responses: {
      200: {
        description: `Updated ${input.label}`,
        content: { 'application/json': { schema: input.settingsSchema } },
      },
      400: { description: 'Validation or business rule error' },
      403: { description: docs.write403 },
      404: { description: docs.notFound },
    },
  });
};
