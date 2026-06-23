import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const ListFilesQuerySchema = z
  .object({
    pageToken: z.string().optional(),
  })
  .openapi('Files_ListFilesQuery');

export const PresignBodySchema = z
  .object({
    operation: z.enum(['get', 'put']),
    engineFileRef: z.string().optional(),
    filename: z.string().optional(),
    expiresIn: z.number().optional(),
    contentType: z.string().optional(),
  })
  .openapi('Files_PresignBody');

export const FileItemSchema = z
  .object({
    engineFileRef: z.string(),
    filename: z.string().optional(),
    contentType: z.string().optional(),
    size: z.number().optional(),
    publicUrl: z.string().optional(),
    createdAt: z.string().optional(),
  })
  .openapi('Files_FileItem');

export const ListFilesResponseSchema = z
  .object({
    items: z.array(FileItemSchema),
    nextPageToken: z.string().optional(),
  })
  .openapi('Files_ListFilesResponse');

export function registerFilesOpenApi(registry: OpenAPIRegistry) {
  const tag = 'core.files';

  registry.registerPath({
    method: 'post',
    path: '/files/{plugin}',
    tags: [tag],
    security: [{ bearerAuth: [] }],
    request: {
      // upload is multipart/form-data; require formVersionId (and optional submissionId & formId)
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: z.object({
              formId: z.string().optional(),
              formVersionId: z.string().min(1),
              submissionId: z.string().optional(),
              // files are binary fields; not easily represented here
            }),
          },
        },
      },
      params: z.object({ plugin: z.string().min(1) }).openapi('Files_PluginParam'),
    },
    responses: {
      200: {
        description: 'Uploaded file metadata',
        content: { 'application/json': { schema: FileItemSchema } },
      },
      400: { description: 'Invalid request' },
      404: { description: 'Plugin not found' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/files/{plugin}',
    tags: [tag],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ plugin: z.string().min(1) }).openapi('Files_PluginParam'),
      query: ListFilesQuerySchema,
    },
    responses: {
      200: {
        description: 'List files',
        content: { 'application/json': { schema: ListFilesResponseSchema } },
      },
      404: { description: 'Plugin not found' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/files/{plugin}/{id}',
    tags: [tag],
    security: [{ bearerAuth: [] }],
    request: {
      params: z
        .object({ plugin: z.string().min(1), id: z.string().min(1) })
        .openapi('Files_GetParams'),
    },
    responses: {
      200: { description: 'File download (redirect or stream)', content: {} },
      404: { description: 'Not found' },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/files/{plugin}/{id}',
    tags: [tag],
    security: [{ bearerAuth: [] }],
    request: {
      params: z
        .object({ plugin: z.string().min(1), id: z.string().min(1) })
        .openapi('Files_DeleteParams'),
    },
    responses: {
      204: { description: 'Deleted' },
      404: { description: 'Not found' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/files/{plugin}/presign',
    tags: [tag],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ plugin: z.string().min(1) }).openapi('Files_PluginParam'),
      body: { required: true, content: { 'application/json': { schema: PresignBodySchema } } },
    },
    responses: {
      200: {
        description: 'Presigned URL payload',
        content: {
          'application/json': {
            schema: z.object({ url: z.string(), method: z.string(), expiresIn: z.number() }),
          },
        },
      },
      404: { description: 'Plugin not found' },
    },
  });
}
