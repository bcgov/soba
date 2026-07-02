import express from 'express';
import { validateRequest } from '../shared/validation';
import { workspaceListScope, workspaceFromResource } from '../../middleware/workspaceContext';
import {
  createSubmission,
  deleteSubmission,
  getSubmission,
  getSubmissionData,
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

const submissionResource = workspaceFromResource({ kind: 'submission', idFrom: 'paramsId' });

router.get(
  '/',
  validateRequest({ query: ListSubmissionsQuerySchema }),
  workspaceListScope({
    anchorOrder: ['submissionId', 'formVersionId', 'formId', 'workspaceId'],
  }),
  listSubmissions,
);
router.get(
  '/:id',
  validateRequest({ params: UpdateSubmissionParamsSchema }),
  submissionResource,
  getSubmission,
);
router.get(
  '/:id/data',
  validateRequest({ params: UpdateSubmissionParamsSchema }),
  submissionResource,
  getSubmissionData,
);

// POST '/' and POST '/:id/save' are served by the optionally-authenticated public submission
// router mounted earlier in app.ts (workspace derived from the form's visibility there).
router.post('/', validateRequest({ body: CreateSubmissionBodySchema }), createSubmission);
router.patch(
  '/:id',
  validateRequest({
    params: UpdateSubmissionParamsSchema,
    body: UpdateSubmissionBodySchema,
  }),
  submissionResource,
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
router.delete(
  '/:id',
  validateRequest({ params: UpdateSubmissionParamsSchema }),
  submissionResource,
  deleteSubmission,
);

export { router as submissionsRouter };
