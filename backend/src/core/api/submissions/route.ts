import express from 'express';
import { validateRequest } from '../shared/validation';
import {
  createSubmission,
  deleteSubmission,
  getSubmission,
  listSubmissions,
  saveSubmission,
  updateSubmission,
} from './controller';
import {
  CreateSubmissionBodySchema,
  ListSubmissionsQuerySchema,
  SaveSubmissionBodySchema,
  SaveSubmissionParamsSchema,
  UpdateSubmissionBodySchema,
  UpdateSubmissionParamsSchema,
} from './schema';

const router = express.Router();

router.get('/', validateRequest({ query: ListSubmissionsQuerySchema }), listSubmissions);
router.get('/:id', validateRequest({ params: UpdateSubmissionParamsSchema }), getSubmission);

router.post('/', validateRequest({ body: CreateSubmissionBodySchema }), createSubmission);
router.patch(
  '/:id',
  validateRequest({
    params: UpdateSubmissionParamsSchema,
    body: UpdateSubmissionBodySchema,
  }),
  updateSubmission,
);
router.post(
  '/:id/save',
  validateRequest({
    params: SaveSubmissionParamsSchema,
    body: SaveSubmissionBodySchema,
  }),
  saveSubmission,
);
router.delete('/:id', validateRequest({ params: UpdateSubmissionParamsSchema }), deleteSubmission);

export { router as submissionsRouter };
