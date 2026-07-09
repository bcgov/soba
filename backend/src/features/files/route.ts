import express from 'express';
import multer from 'multer';
import { env } from '../../core/config/env';
import { requireFeature } from '../../core/middleware/requireFeature';
import { workspaceFromQuery } from '../../core/middleware/workspaceContext';
import {
  uploadFileHandler,
  downloadFileHandler,
  deleteFileHandler,
  getFilesConfigHandler,
} from './controller';

const router = express.Router();

const maxSizeMb = env.getFilesMaxFileSizeMb();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSizeMb * 1024 * 1024 },
});

// Gate the whole feature on the `soba.feature` 'files' flag.
router.use(requireFeature('files'));

// Upload: workspace comes from the ?workspaceId query; workspaceFromQuery enforces membership.
// Accept any file field name (Form.io's fileKey is configurable; the component uploads one at a time).
router.post('/', workspaceFromQuery, upload.any(), uploadFileHandler);

// Client-facing config (size limit + blocked extensions). Must be declared before '/:id'.
router.get('/config', getFilesConfigHandler);

// Download / delete: workspace is derived from the file row and checked against the actor,
// so no workspace query param is required.
router.get('/:id', downloadFileHandler);
router.delete('/:id', deleteFileHandler);

export { router as filesRouter };
