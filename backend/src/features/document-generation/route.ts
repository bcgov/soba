import express from 'express';
import { requireFeature } from '../../core/middleware/requireFeature';
import { Features } from '../../core/db/codes';
import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { validateRequest } from '../../core/api/shared/validation';
import { previewDocumentHandler, printDocumentHandler } from './controller';
import { PreviewBodySchema, PrintBodySchema, SubmissionIdParamSchema } from './schema';

const router = express.Router();

// Gate the whole feature on the `document-generation` flag (within the submit surface's submit-mode).
router.use(requireFeature(Features.document_generation));

// Mounted under /submit/submissions, so these are /submit/submissions/:id/{preview,print}.
// preview: render the caller's live on-screen data (submission is the authorization anchor).
router.post(
  '/:id/preview',
  validateRequest({ params: SubmissionIdParamSchema, body: PreviewBodySchema }),
  asyncHandler(previewDocumentHandler),
);

// print: render the submission's persisted data (read from the form engine).
router.post(
  '/:id/print',
  validateRequest({ params: SubmissionIdParamSchema, body: PrintBodySchema }),
  asyncHandler(printDocumentHandler),
);

export { router as documentGenerationRouter };
