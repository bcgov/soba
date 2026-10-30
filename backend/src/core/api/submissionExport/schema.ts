import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  StartSubmissionExportBodySchema as LibStartSubmissionExportBodySchema,
  SubmissionExportFieldsBodySchema as LibSubmissionExportFieldsBodySchema,
  SubmissionExportFieldsResponseSchema as LibSubmissionExportFieldsResponseSchema,
  SubmissionExportListSchema as LibSubmissionExportListSchema,
  SubmissionExportSchema as LibSubmissionExportSchema,
} from '@soba/lib';

extendZodWithOpenApi(z);

const EXPORTS_PATH = '/design/forms/{id}/exports';
const SAMPLE_NOTE = 'Sample data held in memory until exports run as jobs.';

export const FormIdParamSchema = z.object({ id: z.uuid() }).openapi('SubmissionExport_FormIdParam');

export const ExportIdParamSchema = FormIdParamSchema.extend({ exportId: z.uuid() }).openapi(
  'SubmissionExport_ExportIdParam',
);

export const SubmissionExportFieldsBodySchema = LibSubmissionExportFieldsBodySchema.clone().openapi(
  'SubmissionExport_FieldsBody',
);

export const StartSubmissionExportBodySchema = LibStartSubmissionExportBodySchema.clone().openapi(
  'SubmissionExport_StartBody',
);

const SubmissionExportFieldsResponseSchema =
  LibSubmissionExportFieldsResponseSchema.clone().openapi('SubmissionExport_FieldsResponse');

const SubmissionExportSchema = LibSubmissionExportSchema.clone().openapi('SubmissionExport_Export');

const SubmissionExportListSchema = LibSubmissionExportListSchema.clone().openapi(
  'SubmissionExport_ExportList',
);

const accessResponses = {
  400: { description: 'Invalid form id or request body' },
  401: { description: 'Authentication required' },
  403: { description: 'Not a member of the workspace, or no submission_read on the form' },
  404: { description: 'Form not found' },
} as const;

const jsonBody = (schema: z.ZodType) => ({
  required: true,
  content: { 'application/json': { schema } },
});

const answer = (description: string, schema: z.ZodType) => ({
  description: `${description} ${SAMPLE_NOTE}`,
  content: { 'application/json': { schema } },
});

export function registerSubmissionExportOpenApi(registry: OpenAPIRegistry) {
  const tag = 'design.submission-export';
  const security = [{ bearerAuth: [] }];

  registry.registerPath({
    method: 'post',
    path: `${EXPORTS_PATH}/fields`,
    tags: [tag],
    security,
    summary: 'The fields an export with these filters can include',
    request: { params: FormIdParamSchema, body: jsonBody(SubmissionExportFieldsBodySchema) },
    responses: {
      200: answer('The field list.', SubmissionExportFieldsResponseSchema),
      ...accessResponses,
    },
  });

  registry.registerPath({
    method: 'post',
    path: EXPORTS_PATH,
    tags: [tag],
    security,
    summary: "Start an export of the form's submitted submissions",
    request: { params: FormIdParamSchema, body: jsonBody(StartSubmissionExportBodySchema) },
    responses: {
      201: answer('The export, queued.', SubmissionExportSchema),
      ...accessResponses,
    },
  });

  registry.registerPath({
    method: 'get',
    path: EXPORTS_PATH,
    tags: [tag],
    security,
    summary: "The caller's exports of the form, newest first",
    request: { params: FormIdParamSchema },
    responses: {
      200: answer("The caller's exports.", SubmissionExportListSchema),
      ...accessResponses,
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${EXPORTS_PATH}/{exportId}`,
    tags: [tag],
    security,
    summary: "One of the caller's exports, with its status",
    request: { params: ExportIdParamSchema },
    responses: {
      200: answer('The export.', SubmissionExportSchema),
      ...accessResponses,
      404: { description: 'Form or export not found' },
    },
  });
}
