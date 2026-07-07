import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { FormIdParamsSchema, FormVersionResponseSchema, FormResponseSchema } from '../forms/schema';
import {
  CreateSubmissionBodySchema,
  SaveSubmissionBodySchema,
  SaveSubmissionParamsSchema,
  SubmissionResponseSchema,
  UpdateSubmissionParamsSchema,
} from '../submissions/schema';

extendZodWithOpenApi(z);

export const SubmitFormBundleSchema = z
  .object({
    form: FormResponseSchema.pick({ id: true, name: true, description: true }),
    publishedVersion: FormVersionResponseSchema.pick({
      id: true,
      formId: true,
      versionNo: true,
      state: true,
      publishedAt: true,
    }),
    schema: z.record(z.string(), z.unknown()).nullable(),
  })
  .openapi('Submit_FormBundle');

const TAG = 'core.submit';
const SUBMISSION_PATH = '/submit/submissions/{id}';
const SUBMISSION_NOT_FOUND = 'Submission not found';
const AUTHZ = 'Not in the form submitters audience';
// Optional auth: anonymous is allowed (public audience), or a bearer token for an authenticated
// audience member. `{}` marks the no-auth case explicit rather than leaving security unset.
const PUBLIC_SECURITY = [{}, { bearerAuth: [] }];

export const registerSubmitOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: '/submit/forms/{id}',
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: { params: FormIdParamsSchema },
    responses: {
      200: {
        description: 'Published form, its published version, and schema for the public fill page',
        content: { 'application/json': { schema: SubmitFormBundleSchema } },
      },
      401: { description: 'Authentication required (form is not public)' },
      403: { description: AUTHZ },
      404: { description: 'Form not found or has no published version' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${SUBMISSION_PATH}/schema`,
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: { params: UpdateSubmissionParamsSchema },
    responses: {
      200: {
        description:
          "The submission's own form-version schema, for the read-only confirmation view",
        content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } },
      },
      403: { description: AUTHZ },
      404: { description: 'Submission or schema not found' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/submit/submissions',
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: CreateSubmissionBodySchema } },
      },
    },
    responses: {
      201: {
        description: 'Created submission',
        content: { 'application/json': { schema: SubmissionResponseSchema } },
      },
      401: { description: 'Authentication required (form is not public)' },
      403: { description: AUTHZ },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/submit/submissions/{id}/save',
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: {
      params: SaveSubmissionParamsSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: SaveSubmissionBodySchema } },
      },
    },
    responses: {
      200: {
        description: 'Saved submission',
        content: { 'application/json': { schema: SubmissionResponseSchema } },
      },
      403: { description: AUTHZ },
    },
  });

  registry.registerPath({
    method: 'get',
    path: SUBMISSION_PATH,
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: { params: UpdateSubmissionParamsSchema },
    responses: {
      200: {
        description: 'Submission confirmation (audience-readable)',
        content: { 'application/json': { schema: SubmissionResponseSchema } },
      },
      403: { description: AUTHZ },
      404: { description: SUBMISSION_NOT_FOUND },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${SUBMISSION_PATH}/data`,
    tags: [TAG],
    security: PUBLIC_SECURITY,
    request: { params: UpdateSubmissionParamsSchema },
    responses: {
      200: {
        description: 'Submission answer document',
        content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } },
      },
      403: { description: AUTHZ },
      404: { description: 'Submission or its content not found' },
    },
  });
};
