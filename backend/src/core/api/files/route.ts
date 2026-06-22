import express from 'express';
import multer from 'multer';
import { validateRequest } from '../shared/validation';
import {
  uploadFileHandler,
  downloadFileHandler,
  deleteFileHandler,
  listFilesHandler,
  presignHandler,
} from './controller';
import { ListFilesQuerySchema, PresignBodySchema } from './schema';
import { env } from '../../config/env';

const router = express.Router();
const MAX_SIZE = env.getLargestMaxFileSize();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE * 1024 * 1024 },
}); // Limit file size to MAX_SIZE MB

// All routes are namespaced by plugin code: /:plugin/
// Accept any file fields (Form.io may name them differently per component).
router.post('/:plugin', upload.any(), uploadFileHandler);
router.get('/:plugin', validateRequest({ query: ListFilesQuerySchema }), listFilesHandler);
router.get('/:plugin/:id', downloadFileHandler);
router.delete('/:plugin/:id', deleteFileHandler);
router.post('/:plugin/presign', validateRequest({ body: PresignBodySchema }), presignHandler);

export { router as filesRouter };
