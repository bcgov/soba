import { extendZodWithOpenApi, type OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const SubmissionPackageParamsSchema = z
  .object({ id: z.uuid().toLowerCase(), jobId: z.uuid().toLowerCase() })
  .openapi('SubmissionPackage_Params');

export function registerSubmissionPackageOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/design/submissions/{id}/packages/{jobId}/file',
    tags: ['design.submission-package'],
    security: [{ bearerAuth: [] }],
    summary: 'Download a package of the submission (needs submission_read)',
    request: { params: SubmissionPackageParamsSchema },
    responses: {
      200: {
        description: 'The package, as an attachment of opaque bytes (stream or redirect)',
        content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
      },
      400: { description: 'Invalid submission or job id' },
      401: { description: 'Authentication required' },
      403: { description: 'Not a member of the workspace, or no submission_read on the form' },
      404: {
        description:
          "Submission not found, packages off for its form, or the job is not one of the submission's packages, is not ready or has expired",
      },
      503: { description: 'The download could not be recorded' },
    },
  });
}
