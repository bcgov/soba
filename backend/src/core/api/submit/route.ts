import express from 'express';
import { validateRequest } from '../shared/validation';
import { openWorkspaceFromResource } from '../../middleware/workspaceContext';
import { requireFormAccess, requireFormSubmitAccess } from '../../middleware/formSubmitAccess';
import { Permissions } from '../../db/codes';
import { getSubmitForm, getSubmitSubmissionSchema } from './controller';
import {
  createSubmission,
  getSubmission,
  getSubmissionData,
  saveSubmission,
} from '../submissions/controller';
import { FormIdParamsSchema } from '../forms/schema';
import {
  CreateSubmissionBodySchema,
  SaveSubmissionBodySchema,
  SaveSubmissionParamsSchema,
  UpdateSubmissionParamsSchema,
} from '../submissions/schema';

// Submit-mode: mounted under /api/v1/submit with optional auth (anonymous resolves to the public user).
// Access is decided by the workspace Form submitters audience (requireFormAccess / requireFormSubmitAccess),
// so non-members and anonymous callers can read a published form, submit to it, and view the confirmation.
const router = express.Router();

const openFormResource = openWorkspaceFromResource({ kind: 'form', idFrom: 'paramsId' });
const openSubmissionResource = openWorkspaceFromResource({
  kind: 'submission',
  idFrom: 'paramsId',
});

// The published form + schema needed to render the fill page.
router.get(
  '/forms/:id',
  validateRequest({ params: FormIdParamsSchema }),
  openFormResource,
  requireFormAccess(Permissions.form_read),
  getSubmitForm,
);

router.post(
  '/submissions',
  validateRequest({ body: CreateSubmissionBodySchema }),
  requireFormSubmitAccess,
  createSubmission,
);
router.post(
  '/submissions/:id/save',
  validateRequest({ params: SaveSubmissionParamsSchema, body: SaveSubmissionBodySchema }),
  requireFormSubmitAccess,
  saveSubmission,
);

// Confirmation read (a public form's submissions are public data; the UUID is the practical capability).
router.get(
  '/submissions/:id',
  validateRequest({ params: UpdateSubmissionParamsSchema }),
  openSubmissionResource,
  requireFormAccess(Permissions.submission_read),
  getSubmission,
);
router.get(
  '/submissions/:id/data',
  validateRequest({ params: UpdateSubmissionParamsSchema }),
  openSubmissionResource,
  requireFormAccess(Permissions.submission_read),
  getSubmissionData,
);

// The submission's own form-version schema, for rendering its read-only confirmation.
router.get(
  '/submissions/:id/schema',
  validateRequest({ params: UpdateSubmissionParamsSchema }),
  openSubmissionResource,
  requireFormAccess(Permissions.submission_read),
  getSubmitSubmissionSchema,
);

export { router as submitRouter };
