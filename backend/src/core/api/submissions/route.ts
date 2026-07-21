import express from 'express';
import { validateRequest } from '../shared/validation';
import { workspaceListScope, workspaceFromResource } from '../../middleware/workspaceContext';
import { requireFormPermissions } from '../../middleware/requireFormPermissions';
import { Permissions } from '../../db/codes';
import {
  deleteSubmission,
  getSubmission,
  getSubmissionData,
  listSubmissions,
  streamSubmissions,
} from './controller';
import { ListSubmissionsQuerySchema, SubmissionIdParamsSchema } from './schema';

// Design-mode submission management: mounted under /api/v1/design/submissions with mandatory auth.
// Staff-only (list/read/delete). Opening/saving/submitting a submission and the public confirmation
// read live in the submit feature.
const router = express.Router();

const submissionResource = workspaceFromResource({ kind: 'submission', idFrom: 'paramsId' });
const ID_PATH = '/:id';

router.get(
  '/',
  validateRequest({ query: ListSubmissionsQuerySchema }),
  workspaceListScope({
    anchorOrder: ['submissionId', 'formVersionId', 'formId', 'workspaceId'],
  }),
  requireFormPermissions([Permissions.submission_read]),
  listSubmissions,
);
router.get('/stream', streamSubmissions);
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

export { router as designSubmissionsRouter };
