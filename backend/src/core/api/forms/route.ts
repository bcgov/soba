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
} from './controller';
import {
  CreateFormBodySchema,
  CreateFormVersionBodySchema,
  FormIdParamsSchema,
  FormEngineRefParamsSchema,
  FormVersionIdParamsSchema,
  ListFormsQuerySchema,
  ListFormVersionsQuerySchema,
  SaveFormVersionBodySchema,
  SaveFormVersionParamsSchema,
  UpdateFormBodySchema,
  UpdateFormVersionBodySchema,
} from './schema';

const router = express.Router();

router.get('/forms', validateRequest({ query: ListFormsQuerySchema }), listForms);
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
router.delete(
  '/form-versions/:id',
  validateRequest({ params: FormVersionIdParamsSchema }),
  deleteFormVersion,
);
router.delete('/forms/:id', validateRequest({ params: FormIdParamsSchema }), deleteForm);

export { router as formVersionsRouter };
