import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const NOT_FOUND_DESC = 'Not found';
const AUTH_REQUIRED = 'Authentication required (form is not public)';
const INSUFFICIENT_FORM_PERMISSIONS = 'Insufficient form permissions';
// Public-capable surface: anonymous (public audience) or a bearer token for an authenticated member.
const PUBLIC_SECURITY = [{}, { bearerAuth: [] }];
const FILES_PATH = '/submit/files';
const DESIGN_FILES_PATH = '/design/forms/{id}/files';

export const FormFilesFormParamsSchema = z.object({ id: z.string().uuid() });

export const FormFileParamsSchema = FormFilesFormParamsSchema.extend({
  fileId: z.string().uuid(),
});

export const FileUploadResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    originalName: z.string(),
    size: z.number().nullable(),
    type: z.string().nullable(),
  })
  .openapi('Files_UploadResponse');

export const FileMetadataSchema = z
  .object({
    id: z.string().uuid(),
    formId: z.string().uuid(),
    storageProfile: z.string(),
    filename: z.string(),
    contentType: z.string().nullable(),
    size: z.number().int().nullable(),
    createdBy: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedBy: z.string().nullable(),
    updatedAt: z.string().datetime(),
  })
  .openapi('Files_Metadata');

export function registerFilesOpenApi(registry: OpenAPIRegistry) {
  const tag = 'feature.files';

  registry.registerPath({
    method: 'post',
    path: FILES_PATH,
    tags: [tag],
    security: PUBLIC_SECURITY,
    request: {
      body: {
        required: true,
        content: {
          // multipart/form-data: the binary file field (fileKey; default 'file'), plus the required
          // submissionId the upload is authorized and associated against.
          'multipart/form-data': {
            schema: z.object({
              submissionId: z.string(),
              fileName: z.string().optional(),
              dir: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Uploaded file metadata (Form.io file value)',
        content: { 'application/json': { schema: FileUploadResponseSchema } },
      },
      400: { description: 'Missing submissionId or file' },
      401: { description: AUTH_REQUIRED },
      403: { description: 'Not in the form submitters audience' },
      404: { description: 'Submission not found' },
      409: { description: 'Submission is not accepting file uploads' },
      415: { description: 'File type not allowed (blocked extension)' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: DESIGN_FILES_PATH,
    tags: [tag],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: z.object({ file: z.string(), storageProfile: z.string().optional() }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Uploaded form file metadata',
        content: { 'application/json': { schema: FileMetadataSchema } },
      },
      400: { description: 'Missing file' },
      401: { description: AUTH_REQUIRED },
      403: { description: INSUFFICIENT_FORM_PERMISSIONS },
      404: { description: NOT_FOUND_DESC },
      415: { description: 'File type not allowed' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${DESIGN_FILES_PATH}/{fileId}`,
    tags: [tag],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string().uuid(), fileId: z.string().uuid() }) },
    responses: {
      200: {
        description: 'Form file metadata',
        content: { 'application/json': { schema: FileMetadataSchema } },
      },
      401: { description: AUTH_REQUIRED },
      403: { description: INSUFFICIENT_FORM_PERMISSIONS },
      404: { description: NOT_FOUND_DESC },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${DESIGN_FILES_PATH}/{fileId}/content`,
    tags: [tag],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string().uuid(), fileId: z.string().uuid() }) },
    responses: {
      200: { description: 'File contents', content: {} },
      401: { description: AUTH_REQUIRED },
      403: { description: INSUFFICIENT_FORM_PERMISSIONS },
      404: { description: NOT_FOUND_DESC },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: `${DESIGN_FILES_PATH}/{fileId}`,
    tags: [tag],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string().uuid(), fileId: z.string().uuid() }) },
    responses: {
      204: { description: 'Deleted' },
      401: { description: AUTH_REQUIRED },
      403: { description: INSUFFICIENT_FORM_PERMISSIONS },
      404: { description: NOT_FOUND_DESC },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${FILES_PATH}/{id}`,
    tags: [tag],
    security: PUBLIC_SECURITY,
    request: { params: z.object({ id: z.string().min(1) }).openapi('Files_GetParams') },
    responses: {
      200: { description: 'File contents (stream or redirect)', content: {} },
      401: { description: AUTH_REQUIRED },
      403: { description: 'Not authorized to access this file' },
      404: { description: NOT_FOUND_DESC },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: `${FILES_PATH}/{id}`,
    tags: [tag],
    security: PUBLIC_SECURITY,
    request: { params: z.object({ id: z.string().min(1) }).openapi('Files_DeleteParams') },
    responses: {
      204: { description: 'Deleted' },
      401: { description: AUTH_REQUIRED },
      403: { description: 'Not authorized to delete this file' },
      404: { description: NOT_FOUND_DESC },
    },
  });
}
