import express from 'express';
import { validateRequest } from '../shared/validation';
import {
  workspaceFromQuery,
  workspaceListScope,
  workspaceFromResource,
} from '../../middleware/workspaceContext';
import {
  createForm,
  normalizeFormSchema,
  createFormVersion,
  updateForm,
  getForm,
  getFormVersion,
  listForms,
  listFormVersions,
  deleteForm,
  deleteFormVersion,
  saveFormVersion,
  updateFormVersion,
  publishFormVersion,
  unpublishFormVersion,
  restoreFormVersion,
  provisionFormVersionSchema,
  getFormVersionSchema,
} from './controller';
import {
  CreateFormBodySchema,
  CreateFormVersionBodySchema,
  FormIdParamsSchema,
  FormVersionIdParamsSchema,
  NormalizeSchemaBodySchema,
  ListFormsQuerySchema,
  ListFormVersionsQuerySchema,
  ProvisionSchemaBodySchema,
  SaveFormVersionBodySchema,
  SaveFormVersionParamsSchema,
  UpdateFormBodySchema,
  UpdateFormVersionBodySchema,
} from './schema';

const router = express.Router();

const FORMS_ID_PATH = '/forms/:id';
const FORM_VERSIONS_ID_PATH = '/form-versions/:id';

const formResource = workspaceFromResource({ kind: 'form', idFrom: 'paramsId' });
const formVersionResource = workspaceFromResource({ kind: 'formVersion', idFrom: 'paramsId' });
// Creating a version resolves the workspace from the parent form id in the request body.
const formFromBodyResource = workspaceFromResource({ kind: 'form', idFrom: 'bodyFormId' });

router.get(
  '/forms',
  validateRequest({ query: ListFormsQuerySchema }),
  workspaceListScope({ anchorOrder: ['formId', 'workspaceId'] }),
  listForms,
);
router.post(
  '/forms',
  validateRequest({ body: CreateFormBodySchema }),
  workspaceFromQuery,
  createForm,
);
// Schema-shaping utility; actor-only (no workspace context).
router.post(
  '/forms/normalize',
  validateRequest({ body: NormalizeSchemaBodySchema }),
  normalizeFormSchema,
);
router.get(FORMS_ID_PATH, validateRequest({ params: FormIdParamsSchema }), formResource, getForm);
router.patch(
  FORMS_ID_PATH,
  validateRequest({
    params: FormIdParamsSchema,
    body: UpdateFormBodySchema,
  }),
  formResource,
  updateForm,
);
router.get(
  '/form-versions',
  validateRequest({ query: ListFormVersionsQuerySchema }),
  workspaceListScope({ anchorOrder: ['formVersionId', 'formId', 'workspaceId'] }),
  listFormVersions,
);
router.get(
  FORM_VERSIONS_ID_PATH,
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  getFormVersion,
);

router.post(
  '/form-versions',
  validateRequest({ body: CreateFormVersionBodySchema }),
  formFromBodyResource,
  createFormVersion,
);
router.patch(
  FORM_VERSIONS_ID_PATH,
  validateRequest({
    params: FormVersionIdParamsSchema,
    body: UpdateFormVersionBodySchema,
  }),
  formVersionResource,
  updateFormVersion,
);
router.post(
  '/form-versions/:id/save',
  validateRequest({
    params: SaveFormVersionParamsSchema,
    body: SaveFormVersionBodySchema,
  }),
  formVersionResource,
  saveFormVersion,
);
router.post(
  '/form-versions/:id/publish',
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  publishFormVersion,
);
router.post(
  '/form-versions/:id/unpublish',
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  unpublishFormVersion,
);
router.post(
  '/form-versions/:id/restore',
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  restoreFormVersion,
);
router.get(
  '/form-versions/:id/schema',
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  getFormVersionSchema,
);
router.post(
  '/form-versions/:id/schema',
  validateRequest({ params: FormVersionIdParamsSchema, body: ProvisionSchemaBodySchema }),
  formVersionResource,
  provisionFormVersionSchema,
);
router.delete(
  FORM_VERSIONS_ID_PATH,
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  deleteFormVersion,
);
router.delete(
  FORMS_ID_PATH,
  validateRequest({ params: FormIdParamsSchema }),
  formResource,
  deleteForm,
);

export { router as formVersionsRouter };
