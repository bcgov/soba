import express from 'express';
import { validateRequest } from '../shared/validation';
import {
  createForm,
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
} from './controller';
import {
  CreateFormBodySchema,
  CreateFormVersionBodySchema,
  ListFormsQuerySchema,
  ListFormVersionsQuerySchema,
  SaveFormVersionBodySchema,
  SaveFormVersionParamsSchema,
  UpdateFormBodySchema,
  UpdateFormVersionBodySchema,
  UpdateFormVersionParamsSchema,
} from './schema';

const router = express.Router();

router.get('/forms', validateRequest({ query: ListFormsQuerySchema }), listForms);
router.post('/forms', validateRequest({ body: CreateFormBodySchema }), createForm);
router.get('/forms/:id', validateRequest({ params: UpdateFormVersionParamsSchema }), getForm);
router.patch(
  '/forms/:id',
  validateRequest({
    params: UpdateFormVersionParamsSchema,
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
  validateRequest({ params: UpdateFormVersionParamsSchema }),
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
    params: UpdateFormVersionParamsSchema,
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
  validateRequest({ params: UpdateFormVersionParamsSchema }),
  deleteFormVersion,
);
router.delete('/forms/:id', validateRequest({ params: UpdateFormVersionParamsSchema }), deleteForm);

export { router as formVersionsRouter };
