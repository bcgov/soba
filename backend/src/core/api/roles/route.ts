import express from 'express';
import { validateRequest } from '../shared/validation';
import { workspaceFromResource } from '../../middleware/workspaceContext';
import {
  requireWorkspaceManage,
  requireWorkspacePeopleRead,
} from '../../middleware/requireWorkspaceRole';
import {
  checkRoleNameAvailable,
  createWorkspaceRole,
  deleteWorkspaceRole,
  getWorkspaceRole,
  listWorkspaceRoles,
  updateWorkspaceRole,
} from './controller';
import {
  CreateRoleBodySchema,
  RoleCodeParamsSchema,
  RoleNameAvailabilityQuerySchema,
  UpdateRoleBodySchema,
  WorkspaceRoleParamsSchema,
} from './schema';

const router = express.Router();

const ROLES_PATH = '/workspaces/:id/roles';
const ROLE_PATH = '/workspaces/:id/roles/:roleCode';

// The workspace is resolved from :id, so every route requires workspace membership. Reads also
// require an owner, admin or member role; writes require workspace-management authority.
const workspaceResource = workspaceFromResource({ kind: 'workspace', idFrom: 'paramsId' });

router.get(
  ROLES_PATH,
  validateRequest({ params: WorkspaceRoleParamsSchema }),
  workspaceResource,
  requireWorkspacePeopleRead,
  listWorkspaceRoles,
);
// Before ROLE_PATH, so `name-availability` isn't taken as a role code. Previews a create or rename,
// so it needs the same authority they do.
router.get(
  `${ROLES_PATH}/name-availability`,
  validateRequest({ query: RoleNameAvailabilityQuerySchema, params: WorkspaceRoleParamsSchema }),
  workspaceResource,
  requireWorkspaceManage,
  checkRoleNameAvailable,
);
router.get(
  ROLE_PATH,
  validateRequest({ params: RoleCodeParamsSchema }),
  workspaceResource,
  requireWorkspacePeopleRead,
  getWorkspaceRole,
);
router.post(
  ROLES_PATH,
  validateRequest({ params: WorkspaceRoleParamsSchema, body: CreateRoleBodySchema }),
  workspaceResource,
  requireWorkspaceManage,
  createWorkspaceRole,
);
router.patch(
  ROLE_PATH,
  validateRequest({ params: RoleCodeParamsSchema, body: UpdateRoleBodySchema }),
  workspaceResource,
  requireWorkspaceManage,
  updateWorkspaceRole,
);
router.delete(
  ROLE_PATH,
  validateRequest({ params: RoleCodeParamsSchema }),
  workspaceResource,
  requireWorkspaceManage,
  deleteWorkspaceRole,
);

export { router as rolesRouter };
