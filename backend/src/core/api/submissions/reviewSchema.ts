import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  AddSubmissionNoteBodySchema as SobaAddSubmissionNoteBodySchema,
  SubmissionReviewSchema as SobaSubmissionReviewSchema,
  UpdateSubmissionStatusBodySchema as SobaUpdateSubmissionStatusBodySchema,
} from '@soba/lib';
import { SubmissionIdParamsSchema } from './schema';

extendZodWithOpenApi(z);

// @soba/lib builds its schemas before zod is extended, so they only get `.openapi()` once cloned.
export const SubmissionReviewSchema = SobaSubmissionReviewSchema.clone().openapi(
  'Submissions_SubmissionReview',
);
export const UpdateSubmissionStatusBodySchema =
  SobaUpdateSubmissionStatusBodySchema.clone().openapi('Submissions_UpdateSubmissionStatusBody');
export const AddSubmissionNoteBodySchema = SobaAddSubmissionNoteBodySchema.clone().openapi(
  'Submissions_AddSubmissionNoteBody',
);

const TAG = 'core.submissions';
const REVIEW_PATH = '/design/submissions/{id}/review';
const SAMPLE_NOTE = 'Sample data held in memory until the review tables exist.';

const reviewResponses = (description: string) => ({
  200: {
    description: `${description} ${SAMPLE_NOTE}`,
    content: { 'application/json': { schema: SubmissionReviewSchema } },
  },
  404: { description: 'Submission not found' },
});

export const registerSubmissionReviewOpenApi = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: 'get',
    path: REVIEW_PATH,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: { params: SubmissionIdParamsSchema },
    responses: reviewResponses('Status history, notes and edit history of a submission.'),
  });

  registry.registerPath({
    method: 'post',
    path: `${REVIEW_PATH}/status`,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: SubmissionIdParamsSchema,
      body: { content: { 'application/json': { schema: UpdateSubmissionStatusBodySchema } } },
    },
    responses: reviewResponses('Set the status and assignee; answers with the updated review.'),
  });

  registry.registerPath({
    method: 'post',
    path: `${REVIEW_PATH}/notes`,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: {
      params: SubmissionIdParamsSchema,
      body: { content: { 'application/json': { schema: AddSubmissionNoteBodySchema } } },
    },
    responses: reviewResponses('Add a note; answers with the updated review.'),
  });

  registry.registerPath({
    method: 'post',
    path: `${REVIEW_PATH}/edits`,
    tags: [TAG],
    security: [{ bearerAuth: [] }],
    request: { params: SubmissionIdParamsSchema },
    responses: reviewResponses(
      'Record that staff changed the answers; answers with the updated review.',
    ),
  });
};
