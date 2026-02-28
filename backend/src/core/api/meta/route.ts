import express from 'express';
import { getBuildMeta, getFeaturesMeta, getFormEnginesMeta, getPluginsMeta } from './controller';

const router = express.Router();

router.get('/plugins', getPluginsMeta);
router.get('/features', getFeaturesMeta);
router.get('/form-engines', getFormEnginesMeta);
router.get('/build', getBuildMeta);

export { router as metaRouter };
