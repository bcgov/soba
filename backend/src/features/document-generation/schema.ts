import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const AUTH_REQUIRED = 'Authentication required (form is not public)';
const INSUFFICIENT_FORM_PERMISSIONS = 'Insufficient form permissions';
const FORM_OR_FEATURE_NOT_FOUND = 'Form or feature not found';
// Public-capable surface: anonymous (public audience) or a bearer token for an authenticated member.
const PUBLIC_SECURITY = [{}, { bearerAuth: [] }];
const BASE = '/submit/submissions/{id}';
const DESIGN_BASE = '/design/forms/{id}/document-generation';

// Opaque CDOGS payload parts (passed straight through to the backend). CDOGS validates the contents.
const payloadObject = z.record(z.string(), z.unknown());

export const SubmissionIdParamSchema = z
  .object({ id: z.string().uuid() })
  .openapi('DocumentGeneration_SubmissionIdParam');

export const DocumentGenerationFormParamsSchema = z.object({ id: z.string().uuid() });

export const DocumentGenerationTemplateParamsSchema = DocumentGenerationFormParamsSchema.extend({
  templateId: z.string().uuid(),
});

export const DocumentGenerationConfigurationBodySchema = z.object({
  printableName: z.string().trim().max(255).nullable(),
  defaultTemplateId: z.string().uuid().nullable(),
});

const DocumentGenerationTemplateSchema = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
  formId: z.string().uuid(),
  filename: z.string(),
  contentType: z.string().nullable(),
  size: z.number().int().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedBy: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

const DocumentGenerationConfigurationSchema = z.object({
  formId: z.string().uuid(),
  printableName: z.string().nullable(),
  defaultTemplateId: z.string().uuid().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string().datetime().nullable(),
  updatedBy: z.string().nullable(),
  updatedAt: z.string().datetime().nullable(),
});

const DocumentGenerationSettingsSchema = z.object({
  configuration: DocumentGenerationConfigurationSchema,
  templates: z.array(DocumentGenerationTemplateSchema),
});

export const PreviewBodySchema = z
  .object({
    template: payloadObject,
    options: payloadObject.optional(),
    data: payloadObject,
  })
  .openapi('DocumentGeneration_PreviewBody');

export const PrintBodySchema = z
  .object({
    options: payloadObject.optional(),
  })
  .openapi('DocumentGeneration_PrintBody');

const documentResponses = {
  200: { description: 'Rendered document bytes (attachment)', content: {} },
  401: { description: AUTH_REQUIRED },
  403: {
    description: 'Not authorized, or no document-generation backend available for this scope',
  },
  404: { description: 'Submission not found' },
} as const;

export function registerDocumentGenerationOpenApi(registry: OpenAPIRegistry) {
  const tag = 'feature.document-generation';

  registry.registerPath({
    method: 'post',
    path: `${BASE}/preview`,
    tags: [tag],
    security: PUBLIC_SECURITY,
    summary: 'Render a document from live (on-screen) submission data',
    request: {
      params: SubmissionIdParamSchema,
      body: { required: true, content: { 'application/json': { schema: PreviewBodySchema } } },
    },
    responses: documentResponses,
  });

  registry.registerPath({
    method: 'get',
    path: DESIGN_BASE,
    tags: [tag],
    security: [{ bearerAuth: [] }],
    summary: 'Get form document-generation configuration and templates',
    request: { params: DocumentGenerationFormParamsSchema },
    responses: {
      200: {
        description: 'Configuration and templates',
        content: { 'application/json': { schema: DocumentGenerationSettingsSchema } },
      },
      401: { description: AUTH_REQUIRED },
      403: { description: INSUFFICIENT_FORM_PERMISSIONS },
      404: { description: FORM_OR_FEATURE_NOT_FOUND },
    },
  });

  registry.registerPath({
    method: 'put',
    path: `${DESIGN_BASE}/configuration`,
    tags: [tag],
    security: [{ bearerAuth: [] }],
    summary: 'Set the printable name and default template for a form',
    request: {
      params: DocumentGenerationFormParamsSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: DocumentGenerationConfigurationBodySchema } },
      },
    },
    responses: {
      200: {
        description: 'Updated configuration',
        content: { 'application/json': { schema: DocumentGenerationConfigurationSchema } },
      },
      400: { description: 'Invalid configuration or template belongs to another form' },
      401: { description: AUTH_REQUIRED },
      403: { description: INSUFFICIENT_FORM_PERMISSIONS },
      404: { description: FORM_OR_FEATURE_NOT_FOUND },
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${DESIGN_BASE}/templates`,
    tags: [tag],
    security: [{ bearerAuth: [] }],
    summary: 'Upload a DOCX, PDF, or XLSX template for a form',
    request: {
      params: DocumentGenerationFormParamsSchema,
      body: {
        required: true,
        content: { 'multipart/form-data': { schema: z.object({ file: z.string() }) } },
      },
    },
    responses: {
      201: {
        description: 'Uploaded template',
        content: { 'application/json': { schema: DocumentGenerationTemplateSchema } },
      },
      400: { description: 'Missing file or unsupported template type' },
      401: { description: AUTH_REQUIRED },
      403: { description: INSUFFICIENT_FORM_PERMISSIONS },
      404: { description: FORM_OR_FEATURE_NOT_FOUND },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${DESIGN_BASE}/templates/{templateId}/content`,
    tags: [tag],
    security: [{ bearerAuth: [] }],
    summary: 'Download a form document template',
    request: { params: DocumentGenerationTemplateParamsSchema },
    responses: {
      200: { description: 'Original template file', content: {} },
      401: { description: AUTH_REQUIRED },
      403: { description: INSUFFICIENT_FORM_PERMISSIONS },
      404: { description: 'Form, feature, or template not found' },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: `${DESIGN_BASE}/templates/{templateId}`,
    tags: [tag],
    security: [{ bearerAuth: [] }],
    summary: 'Delete a form document template',
    request: { params: DocumentGenerationTemplateParamsSchema },
    responses: {
      204: { description: 'Deleted' },
      401: { description: AUTH_REQUIRED },
      403: { description: INSUFFICIENT_FORM_PERMISSIONS },
      404: { description: 'Form, feature, or template not found' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${BASE}/print`,
    tags: [tag],
    security: PUBLIC_SECURITY,
    summary: "Render a document from the submission's persisted data",
    request: {
      params: SubmissionIdParamSchema,
      body: { required: true, content: { 'application/json': { schema: PrintBodySchema } } },
    },
    responses: {
      ...documentResponses,
      422: { description: 'Submission has no saved data to print' },
    },
  });
}
