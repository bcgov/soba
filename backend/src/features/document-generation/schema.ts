import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const SUBMISSION_AUTH_REQUIRED =
  'Authentication required (anonymous caller has no access to this submission)';
// Optional auth: anonymous (the public user) or a bearer token. `{}` marks the no-auth case
// explicit rather than leaving security unset.
const PUBLIC_SECURITY = [{}, { bearerAuth: [] }];
const BASE = '/submit/submissions/{id}';

// Backend-specific render options (passed straight through to the backend).
const payloadObject = z.record(z.string(), z.unknown());

const templateId = z
  .uuid()
  .openapi({ description: "A document template on the submission's form version." });

export const SubmissionIdParamSchema = z
  .object({ id: z.uuid() })
  .openapi('DocumentGeneration_SubmissionIdParam');

export const PrintBodySchema = z
  .object({
    templateId,
    options: payloadObject.optional(),
  })
  .openapi('DocumentGeneration_PrintBody');

const SubmissionTemplatesSchema = z
  .object({
    items: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        filename: z.string(),
        createdAt: z.iso.datetime(),
      }),
    ),
  })
  .openapi('DocumentGeneration_SubmissionTemplates');

const accessResponses = {
  401: { description: SUBMISSION_AUTH_REQUIRED },
  403: { description: 'Not authorized to generate documents from this submission' },
} as const;

const documentResponses = {
  200: { description: 'Rendered document bytes (attachment)', content: {} },
  400: { description: 'Invalid submission id or request body' },
  ...accessResponses,
  404: { description: 'Submission or template not found' },
  422: { description: 'Template could not be rendered' },
  429: { description: 'Too many render requests' },
  503: {
    description:
      'No document generation backend available, generation busy, or template content unavailable',
  },
} as const;

export function registerDocumentGenerationOpenApi(registry: OpenAPIRegistry) {
  const tag = 'feature.document-generation';

  registry.registerPath({
    method: 'get',
    path: `${BASE}/templates`,
    tags: [tag],
    security: PUBLIC_SECURITY,
    summary: "The document templates on the submission's form version, by name",
    request: { params: SubmissionIdParamSchema },
    responses: {
      200: {
        description: 'Templates the caller may render from the submission',
        content: { 'application/json': { schema: SubmissionTemplatesSchema } },
      },
      400: { description: 'Invalid submission id' },
      ...accessResponses,
      404: { description: 'Submission not found' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${BASE}/print`,
    tags: [tag],
    security: PUBLIC_SECURITY,
    summary: "Render a document from a stored template and the submission's persisted data",
    request: {
      params: SubmissionIdParamSchema,
      body: { required: true, content: { 'application/json': { schema: PrintBodySchema } } },
    },
    responses: {
      ...documentResponses,
      422: { description: 'Template could not be rendered, or the submission has no saved data' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${BASE}/print/upload`,
    tags: [tag],
    security: PUBLIC_SECURITY,
    summary: "Render a document from an uploaded template and the submission's persisted data",
    request: {
      params: SubmissionIdParamSchema,
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: z.object({ file: z.string().openapi({ format: 'binary' }) }),
          },
        },
      },
    },
    responses: {
      ...documentResponses,
      413: { description: 'Template file too large' },
      415: { description: 'Template file type not accepted' },
      422: {
        description:
          'Template could not be rendered, failed the virus scan, or the submission has no saved data',
      },
    },
  });
}
