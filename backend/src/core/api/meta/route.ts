import express from 'express';
import { validateRequest } from '../shared/validation';
import { requireFeature } from '../../middleware/requireFeature';
import { Features } from '../../db/codes';
import {
  getBuildMeta,
  getCodesMeta,
  getFeaturesMeta,
  getFilesConfigMeta,
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
// Files config is public but only meaningful when the feature is on — gate it so it 404s otherwise.
router.get('/files-config', requireFeature(Features.files), getFilesConfigMeta);
router.get('/codes', validateRequest({ query: ListCodesQuerySchema }), getCodesMeta);
router.get('/roles', validateRequest({ query: ListRolesQuerySchema }), getRolesMeta);

export { router as metaRouter };
