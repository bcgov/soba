import express from 'express';
import { validateRequest } from '../../core/api/shared/validation';
import { SubmissionIdParamsSchema } from '../../core/api/submissions/schema';
import { Features } from '../../core/db/codes';
import {
  loadedSubmission,
  loadSubmitterSubmission,
  requireSubmissionEmailCopy,
} from '../../core/middleware/formSubmitAccess';
import {
  requireFeatureAvailable,
  type FeatureScopeResolver,
} from '../../core/middleware/requireFeatureAvailable';
import { emailSubmissionCopy } from './controller';
import { EmailSubmissionCopyBodySchema } from './schema';

const router = express.Router();

const submissionScope: FeatureScopeResolver = (req) => {
  const { submission } = loadedSubmission(req);
  return { workspaceId: submission.workspaceId, formId: submission.formId };
};

// Mounted under /submit/submissions, so this is /submit/submissions/:id/email-copy. Anyone who may
// read a submitted submission, the public user included, asks for a copy of its confirmation by
// email, where the confirmation screen and email copy features are on and the form's confirmation
// settings allow it.
router.post(
  '/:id/email-copy',
  validateRequest({ params: SubmissionIdParamsSchema, body: EmailSubmissionCopyBodySchema }),
  loadSubmitterSubmission,
  requireFeatureAvailable(Features.confirmation_screen, submissionScope),
  requireFeatureAvailable(Features.confirmation_email_copy, submissionScope),
  requireSubmissionEmailCopy,
  emailSubmissionCopy,
);

export { router as submitterEmailCopyRouter };
