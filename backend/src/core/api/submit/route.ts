import express from 'express';
import { validateRequest } from '../shared/validation';
import { openWorkspaceFromResource } from '../../middleware/workspaceContext';
import { requireFormSubmitAccess, requireSubmissionRead } from '../../middleware/formSubmitAccess';
import { getSubmitSubmissionSchema, getSubmitFillBundle } from './controller';
import {
  openSubmission,
  getSubmission,
  getSubmissionData,
  saveSubmission,
  submitSubmission,
} from '../submissions/controller';
import {
  OpenSubmissionBodySchema,
  SubmissionDataBodySchema,
  SubmissionIdParamsSchema,
  SubmitSubmissionBodySchema,
} from '../submissions/schema';

// Submit-mode: mounted under /api/v1/submit with optional auth (anonymous resolves to the public user).
// Each route authorizes through isSubmitterAllowed (services/submitterAccess).
const router = express.Router();

const openSubmissionResource = openWorkspaceFromResource({
  kind: 'submission',
  idFrom: 'paramsId',
});

router.post(
  '/submissions',
  validateRequest({ body: OpenSubmissionBodySchema }),
  requireFormSubmitAccess,
  openSubmission,
);
router.post(
  '/submissions/:id/save',
  validateRequest({ params: SubmissionIdParamsSchema, body: SubmissionDataBodySchema }),
  requireFormSubmitAccess,
  saveSubmission,
);
router.post(
  '/submissions/:id/submit',
  validateRequest({ params: SubmissionIdParamsSchema, body: SubmitSubmissionBodySchema }),
  requireFormSubmitAccess,
  submitSubmission,
);

router.get(
  '/submissions/:id',
  validateRequest({ params: SubmissionIdParamsSchema }),
  openSubmissionResource,
  requireSubmissionRead,
  getSubmission,
);
router.get(
  '/submissions/:id/data',
  validateRequest({ params: SubmissionIdParamsSchema }),
  openSubmissionResource,
  requireSubmissionRead,
  getSubmissionData,
);

// The submission's own form-version schema, for rendering its read-only confirmation.
router.get(
  '/submissions/:id/schema',
  validateRequest({ params: SubmissionIdParamsSchema }),
  openSubmissionResource,
  requireSubmissionRead,
  getSubmitSubmissionSchema,
);

// The one bundle the fill page needs: workflow state + schema + any saved answers (resume) + whether
// the caller may write.
router.get(
  '/submissions/:id/fill',
  validateRequest({ params: SubmissionIdParamsSchema }),
  openSubmissionResource,
  requireSubmissionRead,
  getSubmitFillBundle,
);

export { router as submitRouter };
