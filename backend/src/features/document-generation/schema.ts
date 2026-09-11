import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const AUTH_REQUIRED = 'Authentication required (form is not public)';
// Public-capable surface: anonymous (public audience) or a bearer token for an authenticated member.
const PUBLIC_SECURITY = [{}, { bearerAuth: [] }];
const BASE = '/submit/submissions/{id}';

// Opaque CDOGS payload parts (passed straight through to the backend). CDOGS validates the contents.
const payloadObject = z.record(z.string(), z.unknown());

export const SubmissionIdParamSchema = z
  .object({ id: z.string().uuid() })
  .openapi('DocumentGeneration_SubmissionIdParam');

export const PreviewBodySchema = z
  .object({
    template: payloadObject,
    options: payloadObject.optional(),
    data: payloadObject,
  })
  .openapi('DocumentGeneration_PreviewBody');

export const PrintBodySchema = z
  .object({
    template: payloadObject,
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
