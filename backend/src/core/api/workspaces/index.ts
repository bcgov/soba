export { workspacesRouter } from './route';
export { registerWorkspacesOpenApi } from './schema';
import { workspacesRouter } from './route';
import { registerWorkspacesOpenApi } from './schema';
import type { CoreDomain } from '../shared/openapi';

export const workspacesDomain: CoreDomain = {
  path: '/',
  router: workspacesRouter,
  registerOpenApi: registerWorkspacesOpenApi,
};
