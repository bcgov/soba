import express, { type RequestHandler } from 'express';
import { validateRequest } from '../../core/api/shared/validation';
import { workspaceFromResource } from '../../core/middleware/workspaceContext';
import { requireFeatureAvailable } from '../../core/middleware/requireFeatureAvailable';
import { FormSettingsParamsSchema } from './schema';
import { formSettingsModules } from './registry';

const formResource = workspaceFromResource({ kind: 'form', idFrom: 'paramsId' });

/**
 * Every settings group at /forms/:id/settings/<key>. Each request resolves the form and its
 * workspace, then the group's feature for that form, before the group's own routes.
 */
export const formSettingsRouter = express.Router({ mergeParams: true });

for (const module of formSettingsModules) {
  const gates: RequestHandler[] = [
    validateRequest({ params: FormSettingsParamsSchema }),
    formResource,
  ];
  if (module.featureCode) {
    gates.push(
      requireFeatureAvailable(module.featureCode, (req) => ({
        workspaceId: req.coreContext?.workspaceId,
        formId: req.params.id,
      })),
    );
  }
  formSettingsRouter.use(`/${module.key}`, ...gates, module.router());
}
