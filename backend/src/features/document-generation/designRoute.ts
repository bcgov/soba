import express from 'express';
import { env } from '../../core/config/env';
import { requireFeature } from '../../core/middleware/requireFeature';
import { requireFormPermissions } from '../../core/middleware/requireFormPermissions';
import { workspaceFromResource } from '../../core/middleware/workspaceContext';
import { parseUpload } from '../../core/middleware/parseUpload';
import { renderRateLimit } from '../../core/middleware/rateLimit';
import { Features, Permissions, PrintUploadPermissions } from '../../core/db/codes';
import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { validateRequest } from '../../core/api/shared/validation';
import {
  listStaffSubmissionTemplatesHandler,
  preparePrintUploadHandler,
  printStaffDocumentHandler,
  printStaffUploadHandler,
} from './controller';
import { holdRenderSlot } from './renderSlots';
import { PrintBodySchema, PrintOptionsSchema, SubmissionIdParamSchema } from './schema';

// Mounted under /design/submissions, so these are /design/submissions/:id/{templates,print}. Each
// checks permissions before the feature flags so a caller without access learns nothing of them.
const router = express.Router();

const submissionResource = workspaceFromResource({ kind: 'submission', idFrom: 'paramsId' });
const features = [requireFeature(Features.document_generation), requireFeature(Features.templates)];
const readsSubmission = requireFormPermissions([Permissions.submission_read]);

router.get(
  '/:id/templates',
  validateRequest({ params: SubmissionIdParamSchema }),
  submissionResource,
  readsSubmission,
  ...features,
  asyncHandler(listStaffSubmissionTemplatesHandler),
);

router.post(
  '/:id/print',
  validateRequest({ params: SubmissionIdParamSchema, body: PrintBodySchema }),
  submissionResource,
  readsSubmission,
  ...features,
  renderRateLimit,
  asyncHandler(printStaffDocumentHandler),
);

// The checks that need no body run before it is read, and the render slot is held from then on,
// so a pod buffers at most one uploaded template per slot.
router.post(
  '/:id/print/upload',
  validateRequest({ params: SubmissionIdParamSchema }),
  submissionResource,
  requireFormPermissions(PrintUploadPermissions),
  ...features,
  renderRateLimit,
  holdRenderSlot(env.getDocumentGenerationMaxConcurrent()),
  asyncHandler(preparePrintUploadHandler),
  parseUpload(env.getTemplatesMaxFileSizeMb() * 1024 * 1024),
  validateRequest({ body: PrintOptionsSchema }),
  asyncHandler(printStaffUploadHandler),
);

export { router as documentGenerationDesignRouter };
