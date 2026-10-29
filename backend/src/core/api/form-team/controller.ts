import type { Request } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '../shared/asyncHandler';
import { formTeamService, type FormTeamContext } from './service';
import type {
  AddFormTeamMemberInput,
  FormTeamMemberParamsSchema,
  ListFormTeamQuery,
  SetFormTeamGroupsBodySchema,
} from './schema';

type MemberParams = z.infer<typeof FormTeamMemberParamsSchema>;
type SetGroupsBody = z.infer<typeof SetFormTeamGroupsBodySchema>;

/** Workspace and form permissions have been resolved by the router before a handler runs. */
const contextOf = (req: Pick<Request, 'coreContext'>): FormTeamContext => ({
  ...req.coreContext!,
  formId: req.coreContext!.formId!,
  permissions: req.coreContext!.permissions!,
});

export const listFormTeam = asyncHandler(async (req: Request, res) => {
  res.json(
    await formTeamService.list(
      contextOf(req),
      req.query as unknown as ListFormTeamQuery,
      req.sortLocale!,
    ),
  );
});

export const listFormTeamCandidates = asyncHandler(async (req: Request, res) => {
  res.json(
    await formTeamService.candidates(
      contextOf(req),
      req.query as unknown as ListFormTeamQuery,
      req.sortLocale!,
    ),
  );
});

export const listFormTeamGroups = asyncHandler(async (req: Request, res) => {
  res.json(await formTeamService.groups(contextOf(req), req.sortLocale!));
});

export const addFormTeamMember = asyncHandler(
  async (req: Request<unknown, unknown, AddFormTeamMemberInput>, res) => {
    res.json(await formTeamService.add(contextOf(req), req.body));
  },
);

export const setFormTeamMemberGroups = asyncHandler(
  async (req: Request<MemberParams, unknown, SetGroupsBody>, res) => {
    res.json(await formTeamService.setGroups(contextOf(req), req.params.userId, req.body.groups));
  },
);

export const removeFormTeamMember = asyncHandler(async (req: Request<MemberParams>, res) => {
  await formTeamService.setGroups(contextOf(req), req.params.userId, []);
  res.status(204).send();
});
