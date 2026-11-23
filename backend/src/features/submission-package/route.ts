import express, { type Request } from 'express';
import { validateRequest } from '../../core/api/shared/validation';
import { Features, Permissions } from '../../core/db/codes';
import { requireFeatureAvailable } from '../../core/middleware/requireFeatureAvailable';
import { requireFormPermissions } from '../../core/middleware/requireFormPermissions';
import { workspaceFromResource } from '../../core/middleware/workspaceContext';
import { downloadPackage } from './controller';
import { SubmissionPackageParamsSchema } from './schema';

// The feature is scoped, so its grant is checked for the submission's form as well as its workspace.
const submissionScope = (req: Request) => ({
  workspaceId: req.coreContext?.workspaceId,
  formId: req.coreContext?.formId,
});

// Mounted at /design; permissions before the feature flag.
const router = express.Router();

router.get(
  '/submissions/:id/packages/:jobId/file',
  validateRequest({ params: SubmissionPackageParamsSchema }),
  workspaceFromResource({ kind: 'submission', idFrom: 'paramsId' }),
  requireFormPermissions([Permissions.submission_read]),
  requireFeatureAvailable(Features.post_submission_email_package, submissionScope),
  downloadPackage,
);

export { router as submissionPackageRouter };
