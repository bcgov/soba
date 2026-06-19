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

const formResource = workspaceFromResource({ kind: 'form', idFrom: 'paramsId' });
const formVersionResource = workspaceFromResource({ kind: 'formVersion', idFrom: 'paramsId' });

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
router.get('/forms/:id', validateRequest({ params: FormIdParamsSchema }), formResource, getForm);
router.patch(
  '/forms/:id',
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
  '/form-versions/:id',
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  getFormVersion,
);

router.post(
  '/form-versions',
  validateRequest({ body: CreateFormVersionBodySchema }),
  workspaceFromResource({ kind: 'form', idFrom: 'bodyFormId' }),
  createFormVersion,
);
router.patch(
  '/form-versions/:id',
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
  '/form-versions/:id',
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  deleteFormVersion,
);
router.delete(
  '/forms/:id',
  validateRequest({ params: FormIdParamsSchema }),
  formResource,
  deleteForm,
);

export { router as formVersionsRouter };
