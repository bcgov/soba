import express from 'express';
import { validateRequest } from '../shared/validation';
import { openWorkspaceFromResource } from '../../middleware/workspaceContext';
import { requireFormAccess, requireFormSubmitAccess } from '../../middleware/formSubmitAccess';
import { Permissions } from '../../db/codes';
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
} from '../submissions/schema';

// Submit-mode: mounted under /api/v1/submit with optional auth (anonymous resolves to the public user).
// Access is decided by the workspace Form submitters audience (requireFormAccess / requireFormSubmitAccess),
// so non-members and anonymous callers can read a published form, submit to it, and view the confirmation.
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
  validateRequest({ params: SubmissionIdParamsSchema, body: SubmissionDataBodySchema }),
  requireFormSubmitAccess,
  submitSubmission,
);

// Confirmation read (a public form's submissions are public data; the UUID is the practical capability).
router.get(
  '/submissions/:id',
  validateRequest({ params: SubmissionIdParamsSchema }),
  openSubmissionResource,
  requireFormAccess(Permissions.submission_read),
  getSubmission,
);
router.get(
  '/submissions/:id/data',
  validateRequest({ params: SubmissionIdParamsSchema }),
  openSubmissionResource,
  requireFormAccess(Permissions.submission_read),
  getSubmissionData,
);

// The submission's own form-version schema, for rendering its read-only confirmation.
router.get(
  '/submissions/:id/schema',
  validateRequest({ params: SubmissionIdParamsSchema }),
  openSubmissionResource,
  requireFormAccess(Permissions.submission_read),
  getSubmitSubmissionSchema,
);

// The one bundle the fill page needs: workflow state + schema + any saved answers (resume).
router.get(
  '/submissions/:id/fill',
  validateRequest({ params: SubmissionIdParamsSchema }),
  openSubmissionResource,
  requireFormAccess(Permissions.submission_read),
  getSubmitFillBundle,
);

export { router as submitRouter };
