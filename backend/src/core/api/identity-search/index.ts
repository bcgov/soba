import express from 'express';
import { workspaceFromQuery } from '../../middleware/workspaceContext';
import { requireWorkspaceManage } from '../../middleware/requireWorkspaceRole';
import type { CoreDomain } from '../shared/openapi';
import { validateRequest } from '../shared/validation';
import { queryIdirUsers } from './controller';
import { IdirUserSearchQuerySchema, registerIdentitySearchOpenApi } from './schema';
const router = express.Router();
// The core router requires authentication. Directory search requires an active
// workspace owner or admin membership, matching workspace group management.
// workspaceId controls access, not search results: CSS searches its full IDIR directory.
// Results may have no Soba account or workspace membership. This route only searches;
// assigning group permissions still requires an existing Soba workspace membership.
router.get(
  '/identity-search/idir',
  validateRequest({ query: IdirUserSearchQuerySchema }),
  workspaceFromQuery,
  requireWorkspaceManage,
  queryIdirUsers,
);
export const identitySearchDomain: CoreDomain = {
  path: '/',
  router,
  registerOpenApi: registerIdentitySearchOpenApi,
};
