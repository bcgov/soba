export { submissionsRouter } from './route';
export { registerSubmissionsOpenApi } from './schema';
import { submissionsRouter } from './route';
import { registerSubmissionsOpenApi } from './schema';
import type { CoreDomain } from '../shared/openapi';

export const submissionsDomain: CoreDomain = {
  path: '/submissions',
  router: submissionsRouter,
  registerOpenApi: registerSubmissionsOpenApi,
};
