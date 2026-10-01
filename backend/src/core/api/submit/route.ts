import express from 'express';
import { validateRequest } from '../shared/validation';
import { openWorkspaceFromResource } from '../../middleware/workspaceContext';
import { sortLocale } from '../../middleware/sortLocale';
import {
  requireFormSubmitAccess,
  requireSignedInSubmitter,
  requireSubmissionDelete,
  requireSubmissionRead,
} from '../../middleware/formSubmitAccess';
import { getSubmitSubmissionSchema, getSubmitFillBundle, listMySubmissions } from './controller';
import { requireDraftSave } from './draftSave';
import {
  openSubmission,
  getSubmission,
  getSubmissionData,
  saveSubmission,
  submitSubmission,
  deleteUnsubmittedSubmission,
} from '../submissions/controller';
import {
  OpenSubmissionBodySchema,
  SubmissionDataBodySchema,
  SubmissionIdParamsSchema,
  SubmitSubmissionBodySchema,
} from '../submissions/schema';
import { ListMySubmissionsQuerySchema } from './schema';

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
  requireDraftSave,
  saveSubmission,
);
router.post(
  '/submissions/:id/submit',
  validateRequest({ params: SubmissionIdParamsSchema, body: SubmitSubmissionBodySchema }),
  requireFormSubmitAccess,
  submitSubmission,
);

// Registered before /submissions/:id, which would otherwise take `mine` as an id.
router.get(
  '/submissions/mine',
  validateRequest({ query: ListMySubmissionsQuerySchema }),
  sortLocale,
  requireSignedInSubmitter,
  listMySubmissions,
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
// the caller may write and save a draft.
router.get(
  '/submissions/:id/fill',
  validateRequest({ params: SubmissionIdParamsSchema }),
  openSubmissionResource,
  requireSubmissionRead,
  getSubmitFillBundle,
);

// The owner deletes their own submission before it is submitted.
router.delete(
  '/submissions/:id',
  validateRequest({ params: SubmissionIdParamsSchema }),
  openSubmissionResource,
  requireSubmissionDelete,
  deleteUnsubmittedSubmission,
);

export { router as submitRouter };
