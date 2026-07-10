import express from 'express';
import { createPluginConfigReader } from '../../config/pluginConfig';
import { env } from '../../config/env';
import { createCdogsRouter } from '../../../plugins/cdogs/cdogsRoutes';

const router = express.Router();

if (env.getOptionalEnv('PLUGIN_CDOGS_BASE_URL')) {
  router.use('/document-generation', createCdogsRouter(createPluginConfigReader('cdogs')));
}

export { router as documentGenerationRouter };
