import express from 'express';
import { validateRequest } from '../shared/validation';
import { workspaceFromResource } from '../../middleware/workspaceContext';
import { requireFormPermissions } from '../../middleware/requireFormPermissions';
import { Permissions } from '../../db/codes';
import { getExport, getExportFields, listExports, startExport } from './controller';
import {
  ExportIdParamSchema,
  FormIdParamSchema,
  StartSubmissionExportBodySchema,
  SubmissionExportFieldsBodySchema,
} from './schema';

// Mounted at /design. Served from sample data for now; see service.
const router = express.Router();

const EXPORTS_PATH = '/forms/:id/exports';
const formResource = workspaceFromResource({ kind: 'form', idFrom: 'paramsId' });
const readsSubmissions = requireFormPermissions([Permissions.submission_read]);

router.post(
  `${EXPORTS_PATH}/fields`,
  validateRequest({ params: FormIdParamSchema, body: SubmissionExportFieldsBodySchema }),
  formResource,
  readsSubmissions,
  getExportFields,
);
router.post(
  EXPORTS_PATH,
  validateRequest({ params: FormIdParamSchema, body: StartSubmissionExportBodySchema }),
  formResource,
  readsSubmissions,
  startExport,
);
router.get(
  EXPORTS_PATH,
  validateRequest({ params: FormIdParamSchema }),
  formResource,
  readsSubmissions,
  listExports,
);
router.get(
  `${EXPORTS_PATH}/:exportId`,
  validateRequest({ params: ExportIdParamSchema }),
  formResource,
  readsSubmissions,
  getExport,
);

export { router as submissionExportRouter };
