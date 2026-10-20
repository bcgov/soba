import express from 'express';
import { validateRequest } from '../shared/validation';
import { asyncHandler } from '../shared/asyncHandler';
import { workspaceFromResource } from '../../middleware/workspaceContext';
import { requireFormPermissions } from '../../middleware/requireFormPermissions';
import { Permissions } from '../../db/codes';
import { exportFieldsHandler, exportHandler } from './controller';
import {
  FormIdParamSchema,
  SubmissionExportBodySchema,
  SubmissionExportFieldsBodySchema,
} from './schema';

// Mounted at /design; needs form_read and submission_read, as in CHEFS 1.
const router = express.Router();

const formResource = workspaceFromResource({ kind: 'form', idFrom: 'paramsId' });
const readsSubmissions = requireFormPermissions([
  Permissions.form_read,
  Permissions.submission_read,
]);

router.post(
  '/forms/:id/export/fields',
  validateRequest({ params: FormIdParamSchema, body: SubmissionExportFieldsBodySchema }),
  formResource,
  readsSubmissions,
  asyncHandler(exportFieldsHandler),
);

router.post(
  '/forms/:id/export',
  validateRequest({ params: FormIdParamSchema, body: SubmissionExportBodySchema }),
  formResource,
  readsSubmissions,
  asyncHandler(exportHandler),
);

export { router as submissionExportRouter };
