import type { CoreDomain } from '../../core/api/shared/openapi';
import { submitterEmailCopyRouter } from './route';
import { registerSubmitterEmailCopyOpenApi } from './schema';

export { isEmailCopyAvailable } from './availability';

/** Mounted under /submit/submissions, before document generation, whose flag gates its whole router. */
export const submitterEmailCopyDomain: CoreDomain = {
  path: '/submissions',
  router: submitterEmailCopyRouter,
  registerOpenApi: registerSubmitterEmailCopyOpenApi,
};
