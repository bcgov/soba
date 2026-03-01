import express from 'express';
import { coreContextMiddleware } from '../middleware/requestContext';
import { requireCoreContext } from '../middleware/requireCoreContext';
import { coreErrorHandler } from '../middleware/errorHandler';
import { formsDomain } from './forms';
import { metaDomain } from './meta';
import { submissionsDomain } from './submissions';
import { registerOpenApiPaths } from './shared/openapi';

const coreDomains = [formsDomain, metaDomain, submissionsDomain];

const router = express.Router();
registerOpenApiPaths((registry) => {
  for (const domain of coreDomains) {
    domain.registerOpenApi(registry);
  }
});

router.use(coreContextMiddleware);
router.use(requireCoreContext);
const authenticatedDomains = [formsDomain, submissionsDomain];
for (const domain of authenticatedDomains) {
  router.use(domain.path, domain.router);
}
router.use(coreErrorHandler);

export { router as coreRouter };
