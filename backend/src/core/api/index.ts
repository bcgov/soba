import express from 'express';
import { coreErrorHandler, notFoundHandler } from '../middleware/errorHandler';
import { registerAdminOpenApi } from './admin';
import { registerHealthOpenApi } from './health';
import { designFormsRouter, registerFormsOpenApi } from './forms';
import {
  designSubmissionsRouter,
  registerSubmissionsOpenApi,
  registerSubmissionReviewOpenApi,
} from './submissions';
import { submitRouter as submitRoutes, registerSubmitOpenApi } from './submit';
import {
  registerSubmissionExportOpenApi,
  submissionExportRouter,
} from '../../features/submission-export';
import { groupsDomain } from './groups';
import { rolesDomain } from './roles';
import { accessDomain } from './access';
import { filesDesignRouter, filesDomain } from '../../features/files';
import {
  registerSubmissionPackageOpenApi,
  submissionPackageRouter,
} from '../../features/submission-package';
import {
  documentGenerationDesignRouter,
  documentGenerationDomain,
} from '../../features/document-generation';
import { templatesDomain } from '../../features/templates';
import { submitterEmailCopyDomain } from '../../features/submitter-email-copy';
import {
  formSettingsRouter,
  registerFormSettingsOpenApi,
  workspaceSettingsRouter,
} from '../../features/form-settings';
import {
  formUserSearchRouter,
  registerUserSearchOpenApi,
  workspaceUserSearchRouter,
} from '../../features/user-search';
import { formJobsRouter, registerJobsOpenApi, workspaceJobsRouter } from '../../features/jobs';
import { meDomain } from './me';
import { membersDomain } from './members';
import { workspacesDomain } from './workspaces';
import { metaDomain } from './meta';
import { registerOpenApiPaths } from './shared/openapi';

// API surfaces, each mounted under its own base path with its own auth (see app.ts):
//  - designRouter   (/api/v1/design): staff form authoring + submission management.
//  - submitRouter   (/api/v1/submit): public-capable submissions, documents.
//  - filesApiRouter (/api/v1/files):  public-capable submission file attachments.
//  - coreRouter     (/api/v1):        workspace/account management, and staff document templates.
registerOpenApiPaths((registry) => {
  registerFormsOpenApi(registry);
  registerFormSettingsOpenApi(registry);
  registerSubmissionsOpenApi(registry);
  registerSubmissionReviewOpenApi(registry);
  registerSubmissionExportOpenApi(registry);
  registerSubmissionPackageOpenApi(registry);
  registerSubmitOpenApi(registry);
  groupsDomain.registerOpenApi(registry);
  rolesDomain.registerOpenApi(registry);
  accessDomain.registerOpenApi(registry);
  meDomain.registerOpenApi(registry);
  registerUserSearchOpenApi(registry);
  registerJobsOpenApi(registry);
  membersDomain.registerOpenApi(registry);
  workspacesDomain.registerOpenApi(registry);
  filesDomain.registerOpenApi(registry);
  submitterEmailCopyDomain.registerOpenApi(registry);
  documentGenerationDomain.registerOpenApi(registry);
  templatesDomain.registerOpenApi(registry);
  metaDomain.registerOpenApi(registry);
  registerAdminOpenApi(registry);
  registerHealthOpenApi(registry);
});

// Design feature: form authoring + submission management. Form settings groups are self-contained
// modules under /forms/:id/settings (features/form-settings).
const designRouter = express.Router();
designRouter.use('/forms/:id/settings', formSettingsRouter);
designRouter.use('/forms/:id/user-search', formUserSearchRouter);
designRouter.use('/forms/:id/jobs', formJobsRouter);
// Submission exports at /forms/:id/exports; gates itself.
designRouter.use(submissionExportRouter);
designRouter.use('/', designFormsRouter);
designRouter.use('/submissions', designSubmissionsRouter);
// Staff print: /submissions/:id/{templates,print} and /print-upload/:id; it gates itself.
designRouter.use(documentGenerationDesignRouter);
// Staff attachment download; gates itself.
designRouter.use(filesDesignRouter);
// Submission package download at /submissions/:id/packages/:jobId/file; gates itself.
designRouter.use(submissionPackageRouter);
designRouter.use(notFoundHandler);
designRouter.use(coreErrorHandler);

// Submit feature: submission open/save/submit, reads of an existing submission, email copy of a
// submitted one and document templates/print, each authorized by the submitter rules in @soba/lib.
const submitRouter = express.Router();
submitRouter.use('/', submitRoutes);
// Before document generation: its router gates every request that reaches it on its own flags.
submitRouter.use(submitterEmailCopyDomain.path, submitterEmailCopyDomain.router);
// Mounted after submitRoutes so only the fall-through actions (templates, print) reach it;
// the document-generation and templates feature gates live inside the router.
submitRouter.use('/submissions', documentGenerationDomain.router);
submitRouter.use(notFoundHandler);
submitRouter.use(coreErrorHandler);

// Files feature: submission attachments, authorized through the submission each file belongs to;
// gates itself on the files flag.
const filesApiRouter = express.Router();
filesApiRouter.use('/', filesDomain.router);
filesApiRouter.use(notFoundHandler);
filesApiRouter.use(coreErrorHandler);

// Core: workspace/account management, and staff document templates.
const coreRouter = express.Router();
// The workspace level of settings groups whose values a workspace shares with its forms.
coreRouter.use('/workspaces/:id/settings', workspaceSettingsRouter);
coreRouter.use('/workspaces/:id/user-search', workspaceUserSearchRouter);
coreRouter.use('/workspaces/:id/jobs', workspaceJobsRouter);
for (const domain of [
  workspacesDomain,
  groupsDomain,
  rolesDomain,
  accessDomain,
  meDomain,
  membersDomain,
  templatesDomain,
]) {
  coreRouter.use(domain.path, domain.router);
}
coreRouter.use(notFoundHandler);
coreRouter.use(coreErrorHandler);

export { designRouter, submitRouter, filesApiRouter, coreRouter };
