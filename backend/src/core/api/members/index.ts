export { membersRouter } from './route';
export { registerMembersOpenApi } from './schema';
import { membersRouter } from './route';
import { registerMembersOpenApi } from './schema';
import type { CoreDomain } from '../shared/openapi';

export const membersDomain: CoreDomain = {
  path: '/members',
  router: membersRouter,
  registerOpenApi: registerMembersOpenApi,
};
