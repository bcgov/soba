import express from 'express';
import { validateRequest } from '../shared/validation';
import { workspaceFromResource } from '../../middleware/workspaceContext';
import { requireWorkspaceManage } from '../../middleware/requireWorkspaceManage';
import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  setGroupRoles,
  addGroupMember,
  removeGroupMember,
} from './controller';
import {
  AddGroupMemberBodySchema,
  CreateGroupBodySchema,
  GroupIdParamsSchema,
  GroupMemberParamsSchema,
  SetGroupRolesBodySchema,
  UpdateGroupBodySchema,
  WorkspaceGroupParamsSchema,
} from './schema';

const router = express.Router();

const GROUPS_PATH = '/workspaces/:id/groups';
const GROUP_PATH = '/workspaces/:id/groups/:groupId';
const GROUP_ROLES_PATH = '/workspaces/:id/groups/:groupId/roles';
const GROUP_MEMBERS_PATH = '/workspaces/:id/groups/:groupId/members';
const GROUP_MEMBER_PATH = '/workspaces/:id/groups/:groupId/members/:memberId';

// The workspace is resolved from :id; every route requires workspace-management authority.
const workspaceResource = workspaceFromResource({ kind: 'workspace', idFrom: 'paramsId' });

router.get(
  GROUPS_PATH,
  validateRequest({ params: WorkspaceGroupParamsSchema }),
  workspaceResource,
  listGroups,
);
router.post(
  GROUPS_PATH,
  validateRequest({ params: WorkspaceGroupParamsSchema, body: CreateGroupBodySchema }),
  workspaceResource,
  requireWorkspaceManage,
  createGroup,
);
router.patch(
  GROUP_PATH,
  validateRequest({ params: GroupIdParamsSchema, body: UpdateGroupBodySchema }),
  workspaceResource,
  requireWorkspaceManage,
  updateGroup,
);
router.delete(
  GROUP_PATH,
  validateRequest({ params: GroupIdParamsSchema }),
  workspaceResource,
  requireWorkspaceManage,
  deleteGroup,
);
router.put(
  GROUP_ROLES_PATH,
  validateRequest({ params: GroupIdParamsSchema, body: SetGroupRolesBodySchema }),
  workspaceResource,
  requireWorkspaceManage,
  setGroupRoles,
);
router.post(
  GROUP_MEMBERS_PATH,
  validateRequest({ params: GroupIdParamsSchema, body: AddGroupMemberBodySchema }),
  workspaceResource,
  requireWorkspaceManage,
  addGroupMember,
);
router.delete(
  GROUP_MEMBER_PATH,
  validateRequest({ params: GroupMemberParamsSchema }),
  workspaceResource,
  requireWorkspaceManage,
  removeGroupMember,
);

export { router as groupsRouter };
