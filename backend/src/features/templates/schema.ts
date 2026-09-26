import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { TEMPLATE_TYPES } from './config';

extendZodWithOpenApi(z);

const TEMPLATES_PATH = '/templates';
const TEMPLATE_PATH = `${TEMPLATES_PATH}/{id}`;
const SECURITY = [{ bearerAuth: [] }];
const NOT_FOUND = { description: 'Not found' };
const FORBIDDEN = { description: 'Insufficient form permissions' };

export const TemplateIdParamsSchema = z.object({ id: z.uuid() }).openapi('Templates_IdParams');

export const TemplatesQuerySchema = z
  .object({ formVersionId: z.uuid() })
  .openapi('Templates_FormVersionQuery');

export const TemplateNameBodySchema = z
  .object({ name: z.string().trim().min(1).max(100) })
  .openapi('Templates_NameBody');

const TemplateSchema = z
  .object({
    id: z.uuid(),
    formId: z.uuid(),
    formVersionId: z.uuid(),
    name: z.string(),
    filename: z.string(),
    contentType: z.string().nullable(),
    size: z.number().int().nullable(),
    createdBy: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedBy: z.string().nullable(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('Templates_Template');

const TemplateListSchema = z
  .object({ items: z.array(TemplateSchema) })
  .openapi('Templates_TemplateList');

const templateResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: TemplateSchema } },
});

const multipartFile = (fields: z.ZodRawShape) => ({
  required: true,
  content: {
    'multipart/form-data': {
      schema: z.object({ file: z.string().openapi({ format: 'binary' }), ...fields }),
    },
  },
});

export function registerTemplatesOpenApi(registry: OpenAPIRegistry) {
  const tags = ['feature.templates'];
  const uploadErrors = {
    400: { description: 'Missing file or name, or a malformed upload' },
    413: { description: 'File too large' },
    415: { description: `Not a template file type (${TEMPLATE_TYPES})` },
    422: { description: 'File failed virus scan' },
    503: { description: 'Virus scanning unavailable' },
  };

  registry.registerPath({
    method: 'get',
    path: TEMPLATES_PATH,
    tags,
    security: SECURITY,
    request: { query: TemplatesQuerySchema },
    responses: {
      200: {
        description: "The form version's templates, by name",
        content: { 'application/json': { schema: TemplateListSchema } },
      },
      403: FORBIDDEN,
      404: NOT_FOUND,
    },
  });

  registry.registerPath({
    method: 'post',
    path: TEMPLATES_PATH,
    tags,
    security: SECURITY,
    request: {
      query: TemplatesQuerySchema,
      body: multipartFile({ name: z.string() }),
    },
    responses: {
      201: templateResponse('Created template'),
      ...uploadErrors,
      403: FORBIDDEN,
      404: NOT_FOUND,
      409: { description: 'A template with this name already exists on the form version' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: TEMPLATE_PATH,
    tags,
    security: SECURITY,
    request: { params: TemplateIdParamsSchema },
    responses: { 200: templateResponse('Template'), 403: FORBIDDEN, 404: NOT_FOUND },
  });

  registry.registerPath({
    method: 'get',
    path: `${TEMPLATE_PATH}/content`,
    tags,
    security: SECURITY,
    request: { params: TemplateIdParamsSchema },
    responses: {
      200: { description: 'Template file (attachment)', content: {} },
      403: FORBIDDEN,
      404: NOT_FOUND,
    },
  });

  registry.registerPath({
    method: 'put',
    path: `${TEMPLATE_PATH}/content`,
    tags,
    security: SECURITY,
    request: { params: TemplateIdParamsSchema, body: multipartFile({}) },
    responses: {
      200: templateResponse('Template with its replaced file'),
      ...uploadErrors,
      403: FORBIDDEN,
      404: NOT_FOUND,
      409: { description: 'Template changed while the request ran' },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: TEMPLATE_PATH,
    tags,
    security: SECURITY,
    request: {
      params: TemplateIdParamsSchema,
      body: { content: { 'application/json': { schema: TemplateNameBodySchema } } },
    },
    responses: {
      200: templateResponse('Renamed template'),
      400: { description: 'Invalid name' },
      403: FORBIDDEN,
      404: NOT_FOUND,
      409: { description: 'A template with this name already exists on the form version' },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: TEMPLATE_PATH,
    tags,
    security: SECURITY,
    request: { params: TemplateIdParamsSchema },
    responses: {
      204: { description: 'Deleted' },
      403: FORBIDDEN,
      404: NOT_FOUND,
      409: { description: 'Template changed while the request ran' },
    },
  });
}
