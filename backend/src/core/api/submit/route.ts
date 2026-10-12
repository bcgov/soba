import express from 'express';
import { validateRequest } from '../shared/validation';
import { sortLocale } from '../../middleware/sortLocale';
import {
  loadSubmitterSubmission,
  requireSignedInSubmitter,
  requireSubmissionDelete,
  requireSubmissionOpen,
  requireSubmissionRead,
  requireSubmissionWrite,
} from '../../middleware/formSubmitAccess';
import {
  getSubmitFillBundle,
  getSubmitSubmission,
  getSubmitSubmissionData,
  getSubmitSubmissionSchema,
  listMyForms,
  listMySubmissions,
  listMyWorkspaces,
} from './controller';
import { requireDraftSave } from './draftSave';
import { replayRecordedOpen, replayRecordedSave, replayRecordedSubmit } from './replay';
import {
  openSubmission,
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
import {
  ListMyFormsQuerySchema,
  ListMySubmissionsQuerySchema,
  MyWorkspaceLookupQuerySchema,
} from './schema';

// Submit-mode: mounted under /api/v1/submit with optional auth (anonymous resolves to the public user).
// A route on one submission reads it once (loadSubmitterSubmission), then one guard decides with the
// @soba/lib rules. Open reads its form once. A repeated open, save or submit gets its recorded answer
// before any guard. The caller's own lists need a signed-in caller.
const router = express.Router();

const submissionParams = validateRequest({ params: SubmissionIdParamsSchema });

router.post(
  '/submissions',
  validateRequest({ body: OpenSubmissionBodySchema }),
  replayRecordedOpen,
  requireSubmissionOpen,
  openSubmission,
);
router.post(
  '/submissions/:id/save',
  validateRequest({ params: SubmissionIdParamsSchema, body: SubmissionDataBodySchema }),
  loadSubmitterSubmission,
  replayRecordedSave,
  requireSubmissionWrite,
  requireDraftSave,
  saveSubmission,
);
router.post(
  '/submissions/:id/submit',
  validateRequest({ params: SubmissionIdParamsSchema, body: SubmitSubmissionBodySchema }),
  loadSubmitterSubmission,
  replayRecordedSubmit,
  requireSubmissionWrite,
  submitSubmission,
);

router.get(
  '/forms/mine',
  validateRequest({ query: ListMyFormsQuerySchema }),
  sortLocale,
  requireSignedInSubmitter,
  listMyForms,
);

router.get(
  '/workspaces/mine',
  validateRequest({ query: MyWorkspaceLookupQuerySchema }),
  sortLocale,
  requireSignedInSubmitter,
  listMyWorkspaces,
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
  submissionParams,
  loadSubmitterSubmission,
  requireSubmissionRead,
  getSubmitSubmission,
);
router.get(
  '/submissions/:id/data',
  submissionParams,
  loadSubmitterSubmission,
  requireSubmissionRead,
  getSubmitSubmissionData,
);

// The submission's own form-version schema, for rendering its read-only confirmation.
router.get(
  '/submissions/:id/schema',
  submissionParams,
  loadSubmitterSubmission,
  requireSubmissionRead,
  getSubmitSubmissionSchema,
);

// The one bundle the fill page needs: workflow state + schema + any saved answers (resume) + whether
// the caller may write and save a draft.
router.get(
  '/submissions/:id/fill',
  submissionParams,
  loadSubmitterSubmission,
  requireSubmissionRead,
  getSubmitFillBundle,
);

// The owner deletes their own submission before it is submitted.
router.delete(
  '/submissions/:id',
  submissionParams,
  loadSubmitterSubmission,
  requireSubmissionDelete,
  deleteUnsubmittedSubmission,
);

export { router as submitRouter };
