import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const NOT_FOUND_DESC = 'Not found';
const SUBMISSION_AUTH_REQUIRED =
  'Authentication required (anonymous caller has no access to this submission)';
// Optional auth: anonymous (the public user) or a bearer token. `{}` marks the no-auth case
// explicit rather than leaving security unset.
const PUBLIC_SECURITY = [{}, { bearerAuth: [] }];
const FILES_PATH = '/files';
// Same routes as /files, mounted under submit for the Form.io file component.
const SUBMIT_FILES_PATH = '/submit/files';

export const FileUploadResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    originalName: z.string(),
    size: z.number().nullable(),
    type: z.string().nullable(),
  })
  .openapi('Files_UploadResponse');

const FileGetParamsSchema = z.object({ id: z.string().min(1) }).openapi('Files_GetParams');
const FileDeleteParamsSchema = z.object({ id: z.string().min(1) }).openapi('Files_DeleteParams');

function registerFilesPaths(
  registry: OpenAPIRegistry,
  { basePath, deprecated }: { basePath: string; deprecated: boolean },
) {
  const tag = 'feature.files';

  registry.registerPath({
    method: 'post',
    path: basePath,
    tags: [tag],
    deprecated,
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
    path: `${basePath}/{id}`,
    tags: [tag],
    deprecated,
    security: PUBLIC_SECURITY,
    request: { params: FileGetParamsSchema },
    responses: {
      200: { description: 'File contents (stream or redirect)', content: {} },
      401: { description: SUBMISSION_AUTH_REQUIRED },
      403: { description: 'Not authorized to access this file' },
      404: { description: NOT_FOUND_DESC },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: `${basePath}/{id}`,
    tags: [tag],
    deprecated,
    security: PUBLIC_SECURITY,
    request: { params: FileDeleteParamsSchema },
    responses: {
      204: { description: 'Deleted' },
      401: { description: SUBMISSION_AUTH_REQUIRED },
      403: { description: 'Not authorized to delete this file' },
      404: { description: NOT_FOUND_DESC },
    },
  });
}

export function registerFilesOpenApi(registry: OpenAPIRegistry) {
  registerFilesPaths(registry, { basePath: FILES_PATH, deprecated: false });
  registerFilesPaths(registry, { basePath: SUBMIT_FILES_PATH, deprecated: true });
}
