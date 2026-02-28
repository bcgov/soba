import express from 'express';
import { coreContextMiddleware } from '../middleware/requestContext';
import { formVersionsRouter, registerFormsOpenApi } from './forms';
import { metaRouter, registerMetaOpenApi } from './meta';
import { submissionsRouter, registerSubmissionsOpenApi } from './submissions';
import { registerOpenApiPaths } from './shared/openapi';

const router = express.Router();
registerOpenApiPaths((registry) => {
  registerFormsOpenApi(registry);
  registerMetaOpenApi(registry);
  registerSubmissionsOpenApi(registry);
});

router.use(coreContextMiddleware);
router.use('/', formVersionsRouter);
router.use('/meta', metaRouter);
router.use('/submissions', submissionsRouter);

export { router as coreRouter };
