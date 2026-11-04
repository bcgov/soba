import express from 'express';
import { validateRequest } from '../shared/validation';
import { sortLocale } from '../../middleware/sortLocale';
import { workspaceFromResource } from '../../middleware/workspaceContext';
import { requireFormPermissions } from '../../middleware/requireFormPermissions';
import { Permissions } from '../../db/codes';
import {
  addTeamMember,
  listTeam,
  listTeamGroups,
  removeTeamMember,
  setTeamGroups,
} from './controller';
import {
  AddFormTeamMemberBodySchema,
  FormTeamMemberParamsSchema,
  FormTeamParamsSchema,
  ListFormTeamQuerySchema,
  SetFormTeamGroupsBodySchema,
} from './schema';

// A form's team, at /design/forms/:id/team. Reads need team_read on the form, changes team_update.
// A change applies to this form only, through the form's overrides of the workspace groups.
const router = express.Router({ mergeParams: true });
const formResource = workspaceFromResource({ kind: 'form', idFrom: 'paramsId' });
const canRead = requireFormPermissions([Permissions.team_read]);
const canUpdate = requireFormPermissions([Permissions.team_update]);

router.get(
  '/',
  validateRequest({ params: FormTeamParamsSchema, query: ListFormTeamQuerySchema }),
  sortLocale,
  formResource,
  canRead,
  listTeam,
);
router.get(
  '/groups',
  validateRequest({ params: FormTeamParamsSchema }),
  sortLocale,
  formResource,
  canRead,
  listTeamGroups,
);
router.post(
  '/',
  validateRequest({ params: FormTeamParamsSchema, body: AddFormTeamMemberBodySchema }),
  sortLocale,
  formResource,
  canUpdate,
  addTeamMember,
);
router.put(
  '/:membershipId/groups',
  validateRequest({ params: FormTeamMemberParamsSchema, body: SetFormTeamGroupsBodySchema }),
  sortLocale,
  formResource,
  canUpdate,
  setTeamGroups,
);
router.delete(
  '/:membershipId',
  validateRequest({ params: FormTeamMemberParamsSchema }),
  sortLocale,
  formResource,
  canUpdate,
  removeTeamMember,
);

export { router as formTeamRouter };
