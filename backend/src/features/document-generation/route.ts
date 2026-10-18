import express from 'express';
import { env } from '../../core/config/env';
import { requireFeature } from '../../core/middleware/requireFeature';
import { parseUpload } from '../../core/middleware/parseUpload';
import { renderRateLimit } from '../../core/middleware/rateLimit';
import { Features } from '../../core/db/codes';
import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { validateRequest } from '../../core/api/shared/validation';
import {
  listSubmissionTemplatesHandler,
  printDocumentHandler,
  printUploadedTemplateHandler,
} from './controller';
import { PrintBodySchema, SubmissionIdParamSchema } from './schema';

const router = express.Router();

const upload = parseUpload(env.getTemplatesMaxFileSizeMb() * 1024 * 1024);

// Gate the whole feature on the `document-generation` and `templates` flags (within the submit
// surface's submit-mode).
router.use(requireFeature(Features.document_generation), requireFeature(Features.templates));

// Mounted under /submit/submissions, so these are /submit/submissions/:id/{templates,print}.
// templates: what the caller may render from the submission.
router.get(
  '/:id/templates',
  validateRequest({ params: SubmissionIdParamSchema }),
  asyncHandler(listSubmissionTemplatesHandler),
);

// print: render the submission's persisted data (read from the form engine).
router.post(
  '/:id/print',
  renderRateLimit,
  validateRequest({ params: SubmissionIdParamSchema, body: PrintBodySchema }),
  asyncHandler(printDocumentHandler),
);

// print/upload: like print, but with a template sent in this request (multipart, one file) instead
// of a stored one. Rate limited before the body is read.
router.post(
  '/:id/print/upload',
  renderRateLimit,
  validateRequest({ params: SubmissionIdParamSchema }),
  upload,
  asyncHandler(printUploadedTemplateHandler),
);

export { router as documentGenerationRouter };
