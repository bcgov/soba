import express from 'express';
import { validateRequest } from '../../core/api/shared/validation';
import { SubmissionIdParamsSchema } from '../../core/api/submissions/schema';
import { Features } from '../../core/db/codes';
import {
  loadedSubmission,
  loadSubmitterSubmission,
  requireSubmissionEmailCopy,
} from '../../core/middleware/formSubmitAccess';
import { requireFeatureAvailable } from '../../core/middleware/requireFeatureAvailable';
import { emailSubmissionCopy } from './controller';
import { EmailSubmissionCopyBodySchema } from './schema';

const router = express.Router();

// Mounted under /submit/submissions, so this is /submit/submissions/:id/email-copy. Anyone who may
// read a submitted submission, the public user included, asks for a copy of its confirmation by
// email, where the feature is on and the form's confirmation settings allow it.
router.post(
  '/:id/email-copy',
  validateRequest({ params: SubmissionIdParamsSchema, body: EmailSubmissionCopyBodySchema }),
  loadSubmitterSubmission,
  requireFeatureAvailable(Features.submitter_email_copy, (req) => {
    const { submission } = loadedSubmission(req);
    return { workspaceId: submission.workspaceId, formId: submission.formId };
  }),
  requireSubmissionEmailCopy,
  emailSubmissionCopy,
);

export { router as submitterEmailCopyRouter };
