import express from 'express';
import multer from 'multer';
import { Permissions, Features } from '../../core/db/codes';
import { env } from '../../core/config/env';
import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { validateRequest } from '../../core/api/shared/validation';
import { workspaceFromResource } from '../../core/middleware/workspaceContext';
import { requireFormPermissions } from '../../core/middleware/requireFormPermissions';
import { requireFeature } from '../../core/middleware/requireFeature';
import { requireFormFile } from './fileAccess';
import { FormFileParamsSchema, FormFilesFormParamsSchema } from './schema';
import {
  deleteFileHandler,
  downloadFileHandler,
  getFileMetadataHandler,
  uploadFileHandler,
} from './controller';

const router = express.Router({ mergeParams: true });
const formResource = workspaceFromResource({ kind: 'form', idFrom: 'paramsId' });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.getFilesMaxFileSizeMb() * 1024 * 1024 },
});

router.use(requireFeature(Features.files));
router.use(validateRequest({ params: FormFilesFormParamsSchema }), formResource);

router.post(
  '/',
  requireFormPermissions([Permissions.design_update]),
  upload.single('file'),
  asyncHandler(uploadFileHandler),
);
router.get(
  '/:fileId',
  validateRequest({ params: FormFileParamsSchema }),
  requireFormPermissions([Permissions.form_read]),
  requireFormFile,
  asyncHandler(getFileMetadataHandler),
);
router.get(
  '/:fileId/content',
  validateRequest({ params: FormFileParamsSchema }),
  requireFormPermissions([Permissions.form_read]),
  requireFormFile,
  asyncHandler(downloadFileHandler),
);
router.delete(
  '/:fileId',
  validateRequest({ params: FormFileParamsSchema }),
  requireFormPermissions([Permissions.design_update]),
  requireFormFile,
  asyncHandler(deleteFileHandler),
);

export { router as designFilesRouter };
