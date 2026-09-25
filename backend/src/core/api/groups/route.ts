import express from 'express';
import { validateRequest } from '../shared/validation';
import { SortLocaleQuerySchema } from '../shared/offsetPagination';
import { sortLocale } from '../../middleware/sortLocale';
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
  getSubmitterAudience,
  setSubmitterAudience,
} from './controller';
import {
  AddGroupMemberBodySchema,
  CreateGroupBodySchema,
  GroupIdParamsSchema,
  GroupMemberParamsSchema,
  SetGroupRolesBodySchema,
  SetSubmitterAudienceBodySchema,
  UpdateGroupBodySchema,
  WorkspaceGroupParamsSchema,
} from './schema';

const router = express.Router();

const GROUPS_PATH = '/workspaces/:id/groups';
const GROUP_PATH = '/workspaces/:id/groups/:groupId';
const GROUP_ROLES_PATH = '/workspaces/:id/groups/:groupId/roles';
const GROUP_MEMBERS_PATH = '/workspaces/:id/groups/:groupId/members';
const GROUP_MEMBER_PATH = '/workspaces/:id/groups/:groupId/members/:memberId';
const SUBMITTER_AUDIENCE_PATH = '/workspaces/:id/submitter-audience';

// The workspace is resolved from :id, so every route requires workspace membership. Reads are open
// to any member; writes also require workspace-management authority.
const workspaceResource = workspaceFromResource({ kind: 'workspace', idFrom: 'paramsId' });

router.get(
  GROUPS_PATH,
  validateRequest({ query: SortLocaleQuerySchema, params: WorkspaceGroupParamsSchema }),
  sortLocale,
  workspaceResource,
  listGroups,
);
router.post(
  GROUPS_PATH,
  validateRequest({
    query: SortLocaleQuerySchema,
    params: WorkspaceGroupParamsSchema,
    body: CreateGroupBodySchema,
  }),
  sortLocale,
  workspaceResource,
  requireWorkspaceManage,
  createGroup,
);
router.patch(
  GROUP_PATH,
  validateRequest({
    query: SortLocaleQuerySchema,
    params: GroupIdParamsSchema,
    body: UpdateGroupBodySchema,
  }),
  sortLocale,
  workspaceResource,
  requireWorkspaceManage,
  updateGroup,
);
router.delete(
  GROUP_PATH,
  validateRequest({ query: SortLocaleQuerySchema, params: GroupIdParamsSchema }),
  sortLocale,
  workspaceResource,
  requireWorkspaceManage,
  deleteGroup,
);
router.put(
  GROUP_ROLES_PATH,
  validateRequest({
    query: SortLocaleQuerySchema,
    params: GroupIdParamsSchema,
    body: SetGroupRolesBodySchema,
  }),
  sortLocale,
  workspaceResource,
  requireWorkspaceManage,
  setGroupRoles,
);
router.post(
  GROUP_MEMBERS_PATH,
  validateRequest({
    query: SortLocaleQuerySchema,
    params: GroupIdParamsSchema,
    body: AddGroupMemberBodySchema,
  }),
  sortLocale,
  workspaceResource,
  requireWorkspaceManage,
  addGroupMember,
);
router.delete(
  GROUP_MEMBER_PATH,
  validateRequest({ query: SortLocaleQuerySchema, params: GroupMemberParamsSchema }),
  sortLocale,
  workspaceResource,
  requireWorkspaceManage,
  removeGroupMember,
);
router.get(
  SUBMITTER_AUDIENCE_PATH,
  validateRequest({ query: SortLocaleQuerySchema, params: WorkspaceGroupParamsSchema }),
  sortLocale,
  workspaceResource,
  getSubmitterAudience,
);
router.put(
  SUBMITTER_AUDIENCE_PATH,
  validateRequest({
    query: SortLocaleQuerySchema,
    params: WorkspaceGroupParamsSchema,
    body: SetSubmitterAudienceBodySchema,
  }),
  sortLocale,
  workspaceResource,
  requireWorkspaceManage,
  setSubmitterAudience,
);

export { router as groupsRouter };
