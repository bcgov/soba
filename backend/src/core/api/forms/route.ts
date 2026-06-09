import express from 'express';
import { validateRequest } from '../shared/validation';
import {
  createForm,
  createFormVersion,
  updateForm,
  getForm,
  getFormByEngineRef,
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
  listFormioForms,
} from './controller';
import {
  CreateFormBodySchema,
  CreateFormVersionBodySchema,
  FormIdParamsSchema,
  FormEngineRefParamsSchema,
  FormVersionIdParamsSchema,
  ListFormsQuerySchema,
  ListFormVersionsQuerySchema,
  ProvisionSchemaBodySchema,
  SaveFormVersionBodySchema,
  SaveFormVersionParamsSchema,
  UpdateFormBodySchema,
  UpdateFormVersionBodySchema,
} from './schema';

const router = express.Router();

router.get('/forms', validateRequest({ query: ListFormsQuerySchema }), listForms);
router.get('/forms/formio/form', validateRequest({ query: ListFormsQuerySchema }), listFormioForms);
router.get(
  '/forms/engine/:engineRef',
  validateRequest({ params: FormEngineRefParamsSchema }),
  getFormByEngineRef,
);
router.post('/forms', validateRequest({ body: CreateFormBodySchema }), createForm);
router.get('/forms/:id', validateRequest({ params: FormIdParamsSchema }), getForm);
router.patch(
  '/forms/:id',
  validateRequest({
    params: FormIdParamsSchema,
    body: UpdateFormBodySchema,
  }),
  updateForm,
);
router.get(
  '/form-versions',
  validateRequest({ query: ListFormVersionsQuerySchema }),
  listFormVersions,
);
router.get(
  '/form-versions/:id',
  validateRequest({ params: FormVersionIdParamsSchema }),
  getFormVersion,
);

router.post(
  '/form-versions',
  validateRequest({ body: CreateFormVersionBodySchema }),
  createFormVersion,
);
router.patch(
  '/form-versions/:id',
  validateRequest({
    params: FormVersionIdParamsSchema,
    body: UpdateFormVersionBodySchema,
  }),
  updateFormVersion,
);
router.post(
  '/form-versions/:id/save',
  validateRequest({
    params: SaveFormVersionParamsSchema,
    body: SaveFormVersionBodySchema,
  }),
  saveFormVersion,
);
router.post(
  '/form-versions/:id/publish',
  validateRequest({ params: FormVersionIdParamsSchema }),
  publishFormVersion,
);
router.post(
  '/form-versions/:id/unpublish',
  validateRequest({ params: FormVersionIdParamsSchema }),
  unpublishFormVersion,
);
router.post(
  '/form-versions/:id/restore',
  validateRequest({ params: FormVersionIdParamsSchema }),
  restoreFormVersion,
);
router.get(
  '/form-versions/:id/schema',
  validateRequest({ params: FormVersionIdParamsSchema }),
  getFormVersionSchema,
);
router.post(
  '/form-versions/:id/schema',
  validateRequest({ params: FormVersionIdParamsSchema, body: ProvisionSchemaBodySchema }),
  provisionFormVersionSchema,
);
router.delete(
  '/form-versions/:id',
  validateRequest({ params: FormVersionIdParamsSchema }),
  deleteFormVersion,
);
router.delete('/forms/:id', validateRequest({ params: FormIdParamsSchema }), deleteForm);

export { router as formVersionsRouter };
