import express from 'express';
import multer from 'multer';
import { env } from '../../core/config/env';
import { Permissions, Features } from '../../core/db/codes';
import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { validateRequest } from '../../core/api/shared/validation';
import { workspaceFromResource } from '../../core/middleware/workspaceContext';
import { requireFormPermissions } from '../../core/middleware/requireFormPermissions';
import { requireFeature } from '../../core/middleware/requireFeature';
import {
  deleteDocumentGenerationTemplateHandler,
  downloadDocumentGenerationTemplateHandler,
  getDocumentGenerationConfigurationHandler,
  updateDocumentGenerationConfigurationHandler,
  uploadDocumentGenerationTemplateHandler,
} from './controller';
import {
  DocumentGenerationConfigurationBodySchema,
  DocumentGenerationFormParamsSchema,
  DocumentGenerationTemplateParamsSchema,
} from './schema';

const router = express.Router({ mergeParams: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.getFilesMaxFileSizeMb() * 1024 * 1024 },
});

router.use(requireFeature(Features.document_generation));
router.use(
  validateRequest({ params: DocumentGenerationFormParamsSchema }),
  workspaceFromResource({ kind: 'form', idFrom: 'paramsId' }),
);

router.get(
  '/',
  requireFormPermissions([Permissions.form_read]),
  asyncHandler(getDocumentGenerationConfigurationHandler),
);
router.put(
  '/configuration',
  validateRequest({ body: DocumentGenerationConfigurationBodySchema }),
  requireFormPermissions([Permissions.design_update]),
  asyncHandler(updateDocumentGenerationConfigurationHandler),
);
router.post(
  '/templates',
  requireFormPermissions([Permissions.design_update]),
  upload.single('file'),
  asyncHandler(uploadDocumentGenerationTemplateHandler),
);
router.get(
  '/templates/:templateId/content',
  validateRequest({ params: DocumentGenerationTemplateParamsSchema }),
  requireFormPermissions([Permissions.form_read]),
  asyncHandler(downloadDocumentGenerationTemplateHandler),
);
router.delete(
  '/templates/:templateId',
  validateRequest({ params: DocumentGenerationTemplateParamsSchema }),
  requireFormPermissions([Permissions.design_update]),
  asyncHandler(deleteDocumentGenerationTemplateHandler),
);

export { router as documentGenerationDesignRouter };
