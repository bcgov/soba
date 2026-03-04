import express from 'express';
import { validateRequest } from '../shared/validation';
import {
  getBuildMeta,
  getCodesMeta,
  getFeaturesMeta,
  getFrontendConfigMeta,
  getFormEnginesMeta,
  getPluginsMeta,
  getRolesMeta,
} from './controller';
import { ListCodesQuerySchema, ListRolesQuerySchema } from './schema';

const router = express.Router();

router.get('/plugins', getPluginsMeta);
router.get('/features', getFeaturesMeta);
router.get('/form-engines', getFormEnginesMeta);
router.get('/build', getBuildMeta);
router.get('/frontend-config', getFrontendConfigMeta);
router.get('/codes', validateRequest({ query: ListCodesQuerySchema }), getCodesMeta);
router.get('/roles', validateRequest({ query: ListRolesQuerySchema }), getRolesMeta);

export { router as metaRouter };
