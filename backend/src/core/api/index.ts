import express from 'express';
import { coreContextMiddleware } from '../middleware/requestContext';
import { requireCoreContext } from '../middleware/requireCoreContext';
import { coreErrorHandler } from '../middleware/errorHandler';
import { registerAdminOpenApi } from './admin';
import { registerHealthOpenApi } from './health';
import { formsDomain } from './forms';
import { membersDomain } from './members';
import { metaDomain } from './meta';
import { submissionsDomain } from './submissions';
import { workspacesDomain } from './workspaces';
import { registerOpenApiPaths } from './shared/openapi';

// Meta is mounted at app level at /api/v1/meta and is public (no JWT, no core context).
// Workspaces is mounted first at / so GET /workspaces and GET /workspaces/current are matched before forms.
const coreDomains = [formsDomain, membersDomain, metaDomain, submissionsDomain, workspacesDomain];

const router = express.Router();
registerOpenApiPaths((registry) => {
  for (const domain of coreDomains) {
    domain.registerOpenApi(registry);
  }
  registerAdminOpenApi(registry);
  registerHealthOpenApi(registry);
});

router.use(coreContextMiddleware);
router.use(requireCoreContext);
const authenticatedDomains = [workspacesDomain, formsDomain, membersDomain, submissionsDomain];
for (const domain of authenticatedDomains) {
  router.use(domain.path, domain.router);
}
router.use(coreErrorHandler);

export { router as coreRouter };
