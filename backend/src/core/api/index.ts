import express from 'express';
import { coreErrorHandler } from '../middleware/errorHandler';
import { registerAdminOpenApi } from './admin';
import { registerHealthOpenApi } from './health';
import { designFormsRouter, registerFormsOpenApi } from './forms';
import { designSubmissionsRouter, registerSubmissionsOpenApi } from './submissions';
import { submitRouter as submitRoutes, registerSubmitOpenApi } from './submit';
import { groupsDomain } from './groups';
import { filesDomain } from '../../features/files';
import { meDomain } from './me';
import { membersDomain } from './members';
import { workspacesDomain } from './workspaces';
import { registerOpenApiPaths } from './shared/openapi';

// API surfaces, each mounted under its own base path with its own auth (see app.ts):
//  - designRouter  (/api/v1/design): staff form authoring + submission management.
//  - submitRouter  (/api/v1/submit): public-capable form read/submit/confirmation.
//  - filesRouter   (/api/v1/files):  public-capable attachment upload/download/delete.
//  - coreRouter    (/api/v1):        workspace/account management (not a toggled feature).
registerOpenApiPaths((registry) => {
  registerFormsOpenApi(registry);
  registerSubmissionsOpenApi(registry);
  registerSubmitOpenApi(registry);
  groupsDomain.registerOpenApi(registry);
  meDomain.registerOpenApi(registry);
  membersDomain.registerOpenApi(registry);
  workspacesDomain.registerOpenApi(registry);
  filesDomain.registerOpenApi(registry);
  registerAdminOpenApi(registry);
  registerHealthOpenApi(registry);
});

// Design feature: form authoring + submission management.
const designRouter = express.Router();
designRouter.use('/', designFormsRouter);
designRouter.use('/submissions', designSubmissionsRouter);
designRouter.use(coreErrorHandler);

// Submit feature: public form read + submission create/save + confirmation read.
const submitRouter = express.Router();
submitRouter.use('/', submitRoutes);
submitRouter.use(coreErrorHandler);

// Files feature: public-capable attachment upload/download/delete, authorized per operation by the
// Form submitters audience / submission ownership. Its own base path in app.ts, not under core.
const filesRouter = express.Router();
filesRouter.use(filesDomain.router);
filesRouter.use(coreErrorHandler);

// Core: workspace/account management.
const coreRouter = express.Router();
for (const domain of [workspacesDomain, groupsDomain, meDomain, membersDomain]) {
  coreRouter.use(domain.path, domain.router);
}
coreRouter.use(coreErrorHandler);

export { designRouter, submitRouter, coreRouter, filesRouter };
