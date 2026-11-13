import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { EmailSubmissionCopyBodySchema as LibEmailSubmissionCopyBodySchema } from '@soba/lib';
import { SubmissionIdParamsSchema } from '../../core/api/submissions/schema';

extendZodWithOpenApi(z);

const TAG = 'core.submit';
// Optional auth: anonymous (the public user) or a bearer token. `{}` marks the no-auth case
// explicit rather than leaving security unset.
const PUBLIC_SECURITY = [{}, { bearerAuth: [] }];

/** A submitter asking for a copy of their confirmation: the one address to send it to. */
export const EmailSubmissionCopyBodySchema = LibEmailSubmissionCopyBodySchema.clone().openapi(
  'Submit_EmailSubmissionCopyBody',
);

export const registerSubmitterEmailCopyOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'post',
    path: '/submit/submissions/{id}/email-copy',
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: {
      params: SubmissionIdParamsSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: EmailSubmissionCopyBodySchema } },
      },
    },
    responses: {
      202: {
        description:
          'Queued: one email, English then French, with the form name, its confirmation ID and a link to it. Never its answers.',
      },
      400: { description: 'Invalid body (one address, and nothing else)' },
      401: {
        description: 'Authentication required (anonymous caller has no access to this submission)',
      },
      403: {
        description:
          "Not a participant on this submission, or the form's confirmation settings do not offer an email copy (email_copy_disabled)",
      },
      404: {
        description: 'Submission not found, or submitter email copy is not available here',
      },
      409: { description: 'The submission is not submitted (email_copy_closed)' },
      429: {
        description:
          'An hourly limit on copies (per submission, address, form, workspace or environment) is reached (email_copy_limit_reached)',
      },
      503: { description: 'Notifications are off here (email_copy_unavailable)' },
    },
  });
};
