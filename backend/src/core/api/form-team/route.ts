import express from 'express';
import { validateRequest } from '../shared/validation';
import { workspaceFromResource } from '../../middleware/workspaceContext';
import { requireFormPermissions } from '../../middleware/requireFormPermissions';
import { sortLocale } from '../../middleware/sortLocale';
import { Permissions } from '../../db/codes';
import {
  addFormTeamMember,
  listFormTeam,
  listFormTeamCandidates,
  listFormTeamGroups,
  removeFormTeamMember,
  setFormTeamMemberGroups,
} from './controller';
import {
  AddFormTeamMemberBodySchema,
  SetFormTeamGroupsBodySchema,
  FormTeamMemberParamsSchema,
  FormTeamParamsSchema,
  ListFormTeamQuerySchema,
} from './schema';

const router = express.Router({ mergeParams: true });
router.use(
  validateRequest({ params: FormTeamParamsSchema }),
  workspaceFromResource({ kind: 'form', idFrom: 'paramsId' }),
  requireFormPermissions([Permissions.team_update]),
  sortLocale,
);
router.get('/', validateRequest({ query: ListFormTeamQuerySchema }), listFormTeam);
router.get('/groups', listFormTeamGroups);
router.get(
  '/candidates',
  validateRequest({ query: ListFormTeamQuerySchema }),
  listFormTeamCandidates,
);
router.post('/', validateRequest({ body: AddFormTeamMemberBodySchema }), addFormTeamMember);
router.put(
  '/:userId/groups',
  validateRequest({ params: FormTeamMemberParamsSchema, body: SetFormTeamGroupsBodySchema }),
  setFormTeamMemberGroups,
);
router.delete(
  '/:userId',
  validateRequest({ params: FormTeamMemberParamsSchema }),
  removeFormTeamMember,
);
export { router as formTeamRouter };
