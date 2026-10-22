import express from 'express';
import { validateRequest } from '../shared/validation';
import { sortLocale } from '../../middleware/sortLocale';
import { workspaceListScope, workspaceFromResource } from '../../middleware/workspaceContext';
import { requireFormPermissions } from '../../middleware/requireFormPermissions';
import { Permissions } from '../../db/codes';
import { deleteSubmission, getSubmission, getSubmissionData, listSubmissions } from './controller';
import {
  addSubmissionNote,
  getSubmissionReview,
  recordSubmissionEdit,
  updateSubmissionStatus,
} from './reviewController';
import { AddSubmissionNoteBodySchema, UpdateSubmissionStatusBodySchema } from './reviewSchema';
import { ListSubmissionsQuerySchema, SubmissionIdParamsSchema } from './schema';

// Design-mode submission management: mounted under /api/v1/design/submissions with mandatory auth.
// Staff-only (list/read/delete). Opening/saving/submitting a submission and the submit-mode
// confirmation read live in the submit feature.
const router = express.Router();

const submissionResource = workspaceFromResource({ kind: 'submission', idFrom: 'paramsId' });
const ID_PATH = '/:id';
const REVIEW_PATH = `${ID_PATH}/review`;

router.get(
  '/',
  validateRequest({ query: ListSubmissionsQuerySchema }),
  sortLocale,
  workspaceListScope({
    anchorOrder: ['submissionId', 'formVersionId', 'formId', 'workspaceId'],
  }),
  requireFormPermissions([Permissions.submission_read]),
  listSubmissions,
);
router.get(
  ID_PATH,
  validateRequest({ params: SubmissionIdParamsSchema }),
  submissionResource,
  requireFormPermissions([Permissions.submission_read]),
  getSubmission,
);
router.get(
  `${ID_PATH}/data`,
  validateRequest({ params: SubmissionIdParamsSchema }),
  submissionResource,
  requireFormPermissions([Permissions.submission_read]),
  getSubmissionData,
);
router.delete(
  ID_PATH,
  validateRequest({ params: SubmissionIdParamsSchema }),
  submissionResource,
  requireFormPermissions([Permissions.submission_delete]),
  deleteSubmission,
);

// Review of a submission. Served from sample data for now; see reviewService.
router.get(
  REVIEW_PATH,
  validateRequest({ params: SubmissionIdParamsSchema }),
  submissionResource,
  requireFormPermissions([Permissions.submission_read]),
  getSubmissionReview,
);
router.post(
  `${REVIEW_PATH}/status`,
  validateRequest({ params: SubmissionIdParamsSchema, body: UpdateSubmissionStatusBodySchema }),
  submissionResource,
  requireFormPermissions([Permissions.submission_review]),
  updateSubmissionStatus,
);
router.post(
  `${REVIEW_PATH}/notes`,
  validateRequest({ params: SubmissionIdParamsSchema, body: AddSubmissionNoteBodySchema }),
  submissionResource,
  requireFormPermissions([Permissions.submission_review]),
  addSubmissionNote,
);
router.post(
  `${REVIEW_PATH}/edits`,
  validateRequest({ params: SubmissionIdParamsSchema }),
  submissionResource,
  requireFormPermissions([Permissions.submission_update]),
  recordSubmissionEdit,
);

export { router as designSubmissionsRouter };
