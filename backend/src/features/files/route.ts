import express from 'express';
import multer from 'multer';
import { env } from '../../core/config/env';
import { requireFeature } from '../../core/middleware/requireFeature';
import { Features } from '../../core/db/codes';
import { requireUploadAccess } from './uploadAccess';
import { uploadFileHandler, downloadFileHandler, deleteFileHandler } from './controller';

const router = express.Router();

const maxSizeMb = env.getFilesMaxFileSizeMb();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSizeMb * 1024 * 1024 },
});

// Gate the whole feature on the `soba.feature` files flag.
router.use(requireFeature(Features.files));

// Upload: multer parses the multipart body first, then requireUploadAccess resolves the workspace from
// the `submissionId` field and authorizes it against the Form submitters audience. Accept any file
// field name (Form.io's fileKey is configurable; the component uploads one at a time).
router.post('/', upload.any(), requireUploadAccess, uploadFileHandler);

// Download / delete: workspace is derived from the file row and checked against the actor,
// so no workspace query param is required.
router.get('/:id', downloadFileHandler);
router.delete('/:id', deleteFileHandler);

export { router as filesRouter };
