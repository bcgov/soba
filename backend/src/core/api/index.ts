import express from 'express';
import { coreErrorHandler } from '../middleware/errorHandler';
import { registerAdminOpenApi } from './admin';
import { registerHealthOpenApi } from './health';
import { formsDomain } from './forms';
import { meDomain } from './me';
import { membersDomain } from './members';
import { metaDomain } from './meta';
import { submissionsDomain } from './submissions';
import { filesDomain } from '../../features/files';
import { workspacesDomain } from './workspaces';
import { registerOpenApiPaths } from './shared/openapi';
import { env } from '../config/env';

// Meta is mounted at app level at /api/v1/meta and is public (no JWT, no core context).
// Workspaces is mounted first at / so GET /workspaces and GET /workspaces/current are matched before forms.
const coreDomains = [
  formsDomain,
  meDomain,
  membersDomain,
  metaDomain,
  submissionsDomain,
  workspacesDomain,
];

const authenticatedDomains = [
  workspacesDomain,
  formsDomain,
  meDomain,
  membersDomain,
  submissionsDomain,
];

const featureDomains = [];

const enabledFeatures = env.getEnabledFeatures();
if (enabledFeatures.includes('files')) {
  featureDomains.push(filesDomain);
  authenticatedDomains.push(filesDomain);
}

registerOpenApiPaths((registry) => {
  for (const domain of coreDomains) {
    domain.registerOpenApi(registry);
  }
  for (const domain of featureDomains) {
    domain.registerOpenApi(registry);
  }
  registerAdminOpenApi(registry);
  registerHealthOpenApi(registry);
});

const router = express.Router();
router.use(coreContextMiddleware);
router.use(requireCoreContext);

// Workspace context is resolved per route (see workspaceContext middleware), not globally.
// resolveActor runs at the app level so req.actorId is available to all routes here.
const authenticatedDomains = [
  workspacesDomain,
  formsDomain,
  meDomain,
  membersDomain,
  submissionsDomain,
];
for (const domain of authenticatedDomains) {
  router.use(domain.path, domain.router);
}
router.use(coreErrorHandler);

export { router as coreRouter };
