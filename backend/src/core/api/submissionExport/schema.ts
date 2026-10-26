import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  SubmissionExportBodySchema as LibSubmissionExportBodySchema,
  SubmissionExportFieldsBodySchema as LibSubmissionExportFieldsBodySchema,
  SubmissionExportFieldsResponseSchema as LibSubmissionExportFieldsResponseSchema,
} from '@soba/lib';

extendZodWithOpenApi(z);

const EXPORT_PATH = '/design/forms/{id}/export';

export const FormIdParamSchema = z.object({ id: z.uuid() }).openapi('SubmissionExport_FormIdParam');

export const SubmissionExportFieldsBodySchema = LibSubmissionExportFieldsBodySchema.clone().openapi(
  'SubmissionExport_FieldsBody',
);

export const SubmissionExportBodySchema =
  LibSubmissionExportBodySchema.clone().openapi('SubmissionExport_Body');

const SubmissionExportFieldsResponseSchema =
  LibSubmissionExportFieldsResponseSchema.clone().openapi('SubmissionExport_FieldsResponse');

const accessResponses = {
  400: { description: 'Invalid form id or request body' },
  401: { description: 'Authentication required' },
  403: { description: 'Not a member of the workspace, or insufficient form permissions' },
  404: { description: 'Form not found' },
} as const;

export function registerSubmissionExportOpenApi(registry: OpenAPIRegistry) {
  const tag = 'design.submission-export';
  const security = [{ bearerAuth: [] }];

  registry.registerPath({
    method: 'post',
    path: `${EXPORT_PATH}/fields`,
    tags: [tag],
    security,
    summary: "The CSV columns an export would have, and the caller's last export of the form",
    request: {
      params: FormIdParamSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: SubmissionExportFieldsBodySchema } },
      },
    },
    responses: {
      200: {
        description: 'Columns and last export date',
        content: { 'application/json': { schema: SubmissionExportFieldsResponseSchema } },
      },
      ...accessResponses,
    },
  });

  registry.registerPath({
    method: 'post',
    path: EXPORT_PATH,
    tags: [tag],
    security,
    summary: "Export the form's submissions as CSV or JSON, as CHEFS 1 does; records the export",
    request: {
      params: FormIdParamSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: SubmissionExportBodySchema } },
      },
    },
    responses: {
      200: { description: 'The export file (attachment)', content: {} },
      ...accessResponses,
    },
  });
}
