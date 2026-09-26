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

export const PreviewBodySchema = z
  .object({
    templateId,
    options: payloadObject.optional(),
    data: payloadObject,
  })
  .openapi('DocumentGeneration_PreviewBody');

export const PrintBodySchema = z
  .object({
    templateId,
    options: payloadObject.optional(),
  })
  .openapi('DocumentGeneration_PrintBody');

const SubmissionTemplatesSchema = z
  .object({ items: z.array(z.object({ id: z.uuid(), name: z.string() })) })
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
    path: `${BASE}/preview`,
    tags: [tag],
    security: PUBLIC_SECURITY,
    summary: 'Render a document from a stored template and live (on-screen) submission data',
    request: {
      params: SubmissionIdParamSchema,
      body: { required: true, content: { 'application/json': { schema: PreviewBodySchema } } },
    },
    responses: documentResponses,
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
}
