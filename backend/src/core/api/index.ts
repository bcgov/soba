import express from 'express';
import { coreErrorHandler } from '../middleware/errorHandler';
import { registerAdminOpenApi } from './admin';
import { registerHealthOpenApi } from './health';
import { designFormsRouter, registerFormsOpenApi } from './forms';
import { designSubmissionsRouter, registerSubmissionsOpenApi } from './submissions';
import { submitRouter as submitRoutes, registerSubmitOpenApi } from './submit';
import { groupsDomain } from './groups';
import { filesDomain } from '../../features/files';
import { documentGenerationDomain } from '../../features/document-generation';
import { formSettingsRouter, registerFormSettingsOpenApi } from '../../features/form-settings';
import { meDomain } from './me';
import { membersDomain } from './members';
import { workspacesDomain } from './workspaces';
import { metaDomain } from './meta';
import { registerOpenApiPaths } from './shared/openapi';

// API surfaces, each mounted under its own base path with its own auth (see app.ts):
//  - designRouter   (/api/v1/design): staff form authoring + submission management.
//  - submitRouter   (/api/v1/submit): public-capable submissions, file attachments, preview/print.
//  - filesApiRouter (/api/v1/files):  public-capable submission file attachments.
//  - coreRouter     (/api/v1):        workspace/account management (not a toggled feature).
registerOpenApiPaths((registry) => {
  registerFormsOpenApi(registry);
  registerFormSettingsOpenApi(registry);
  registerSubmissionsOpenApi(registry);
  registerSubmitOpenApi(registry);
  groupsDomain.registerOpenApi(registry);
  meDomain.registerOpenApi(registry);
  membersDomain.registerOpenApi(registry);
  workspacesDomain.registerOpenApi(registry);
  filesDomain.registerOpenApi(registry);
  documentGenerationDomain.registerOpenApi(registry);
  metaDomain.registerOpenApi(registry);
  registerAdminOpenApi(registry);
  registerHealthOpenApi(registry);
});

// Design feature: form authoring + submission management. Form settings groups are self-contained
// modules under /forms/:id/settings (features/form-settings).
const designRouter = express.Router();
designRouter.use('/forms/:id/settings', formSettingsRouter);
designRouter.use('/', designFormsRouter);
designRouter.use('/submissions', designSubmissionsRouter);
designRouter.use(coreErrorHandler);

// Submit feature: submission open/save/submit + reads of an existing submission, plus file
// attachments at /files (upload/download/delete) and document preview/print, each authorized through
// isSubmitterAllowed (services/submitterAccess). The files feature flag is enforced inside
// filesDomain.router. Same routes as /files, mounted under submit for the Form.io file component.
const submitRouter = express.Router();
submitRouter.use('/', submitRoutes);
submitRouter.use('/files', filesDomain.router);
// Mounted after submitRoutes so only the fall-through actions (preview/print) reach it; the
// document-generation feature gate lives inside the router.
submitRouter.use('/submissions', documentGenerationDomain.router);
submitRouter.use(coreErrorHandler);

// Files feature: submission attachments, authorized through the submission each file belongs to.
const filesApiRouter = express.Router();
filesApiRouter.use('/', filesDomain.router);
filesApiRouter.use(coreErrorHandler);

// Core: workspace/account management.
const coreRouter = express.Router();
for (const domain of [workspacesDomain, groupsDomain, meDomain, membersDomain]) {
  coreRouter.use(domain.path, domain.router);
}
coreRouter.use(coreErrorHandler);

export { designRouter, submitRouter, filesApiRouter, coreRouter };
