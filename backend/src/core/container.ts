/**
 * Composition root: wires all core services and adapters once at startup.
 * API imports from here so the dependency graph is explicit in one place.
 */
import { getCacheAdapter } from './integrations/plugins/PluginRegistry';
import { FormService } from './services/formService';
import { FormVersionService } from './services/formVersionService';
import { SubmissionService } from './services/submissionService';
import { createFormsApiService } from './api/forms/serviceFactory';
import { createSubmissionsApiService } from './api/submissions/serviceFactory';

const formService = new FormService();
const formVersionService = new FormVersionService();
const submissionService = new SubmissionService();

export const formsApiService = createFormsApiService(formService, formVersionService);
export const submissionsApiService = createSubmissionsApiService(submissionService);

export function getCache(): ReturnType<typeof getCacheAdapter> {
  return getCacheAdapter();
}
