import express from 'express';
import { validateRequest } from '../shared/validation';
import {
  getBuildMeta,
  getCodesBySetMeta,
  getCodesMeta,
  getFeaturesMeta,
  getFormEnginesMeta,
  getPluginsMeta,
  getRoleByCodeMeta,
  getRolesMeta,
} from './controller';
import { ListRolesQuerySchema } from './schema';

const router = express.Router();

router.get('/plugins', getPluginsMeta);
router.get('/features', getFeaturesMeta);
router.get('/form-engines', getFormEnginesMeta);
router.get('/build', getBuildMeta);
router.get('/codes', getCodesMeta);
router.get('/codes/:codeSet', getCodesBySetMeta);
router.get('/roles', validateRequest({ query: ListRolesQuerySchema }), getRolesMeta);
router.get('/roles/:roleCode', getRoleByCodeMeta);

export { router as metaRouter };
