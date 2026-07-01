import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const NOT_FOUND_DESC = 'Not found';

export const FileUploadResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    originalName: z.string(),
    size: z.number().nullable(),
    type: z.string().nullable(),
  })
  .openapi('Files_UploadResponse');

export const FilesConfigResponseSchema = z
  .object({
    maxFileSizeMb: z.number(),
    blockedExtensions: z.array(z.string()),
  })
  .openapi('Files_Config');

export function registerFilesOpenApi(registry: OpenAPIRegistry) {
  const tag = 'core.files';

  registry.registerPath({
    method: 'get',
    path: '/files/config',
    tags: [tag],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Files feature config (upload size limit + always-blocked extensions)',
        content: { 'application/json': { schema: FilesConfigResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/files',
    tags: [tag],
    security: [{ bearerAuth: [] }],
    request: {
      // Workspace to store under; membership is enforced.
      query: z.object({ workspaceId: z.string().min(1) }).openapi('Files_UploadQuery'),
      body: {
        required: true,
        content: {
          // multipart/form-data: the binary file field (fileKey; default 'file'), plus:
          'multipart/form-data': {
            schema: z.object({
              fileName: z.string().optional(),
              dir: z.string().optional(),
              submissionId: z.string().optional(),
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
      400: { description: 'Invalid request' },
      415: { description: 'File type not allowed (blocked extension)' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/files/{id}',
    tags: [tag],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string().min(1) }).openapi('Files_GetParams') },
    responses: {
      200: { description: 'File contents (stream or redirect)', content: {} },
      404: { description: NOT_FOUND_DESC },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/files/{id}',
    tags: [tag],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string().min(1) }).openapi('Files_DeleteParams') },
    responses: {
      204: { description: 'Deleted' },
      404: { description: NOT_FOUND_DESC },
    },
  });
}
