import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const NOT_FOUND_DESC = 'Not found';
const SUBMISSION_AUTH_REQUIRED =
  'Authentication required (anonymous caller has no access to this submission)';
// Optional auth: anonymous (the public user) or a bearer token. `{}` marks the no-auth case
// explicit rather than leaving security unset.
const PUBLIC_SECURITY = [{}, { bearerAuth: [] }];
const FILES_PATH = '/submit/files';

export const FileUploadResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    originalName: z.string(),
    size: z.number().nullable(),
    type: z.string().nullable(),
  })
  .openapi('Files_UploadResponse');

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
      401: { description: SUBMISSION_AUTH_REQUIRED },
      403: {
        description: 'Not a participant on this submission, or not in the form submitters audience',
      },
      404: { description: 'Submission not found' },
      409: { description: 'Submission is not accepting file uploads' },
      415: { description: 'File type not allowed (blocked extension)' },
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
      401: { description: SUBMISSION_AUTH_REQUIRED },
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
      401: { description: SUBMISSION_AUTH_REQUIRED },
      403: { description: 'Not authorized to delete this file' },
      404: { description: NOT_FOUND_DESC },
    },
  });
}
