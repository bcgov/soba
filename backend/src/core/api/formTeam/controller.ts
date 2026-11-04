import type { Request, Response } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '../shared/asyncHandler';
import { NotFoundError } from '../../errors';
import { FORM_TEAM_MEMBER_NOT_FOUND } from '../../messages';
import { withSortLocale } from '../../middleware/sortLocale';
import {
  addFormTeamMember,
  getFormTeamMember,
  listFormTeam,
  listFormTeamGroups,
  setFormTeamGroups,
} from '../../db/repos/formTeamRepo';
import type {
  AddFormTeamMemberBodySchema,
  ListFormTeamQuerySchema,
  SetFormTeamGroupsBodySchema,
} from './schema';

type ListQuery = z.infer<typeof ListFormTeamQuerySchema>;

/** The form and workspace the route resolved, with the caller and the sort locale. */
const contextOf = (req: Request) => {
  const ctx = withSortLocale(req);
  if (!ctx.formId) throw new Error('The form team routes must resolve the form first');
  return { ...ctx, formId: ctx.formId };
};

const memberOrNotFound = async (ctx: ReturnType<typeof contextOf>, membershipId: string) => {
  const member = await getFormTeamMember(ctx.workspaceId, ctx.formId, membershipId, ctx.locale);
  if (!member) throw new NotFoundError(FORM_TEAM_MEMBER_NOT_FOUND);
  return member;
};

export const listTeam = asyncHandler(async (req: Request, res: Response) => {
  const ctx = contextOf(req);
  const query = req.query as unknown as ListQuery;
  const { items, total } = await listFormTeam({
    workspaceId: ctx.workspaceId,
    formId: ctx.formId,
    offset: query.offset,
    limit: query.limit,
    q: query.q,
    locale: ctx.locale,
  });
  res.json({
    items,
    page: { offset: query.offset, limit: query.limit, total },
    filters: { q: query.q },
  });
});

export const listTeamGroups = asyncHandler(async (req: Request, res: Response) => {
  const ctx = contextOf(req);
  res.json({ items: await listFormTeamGroups(ctx.workspaceId, ctx.locale) });
});

export const addTeamMember = asyncHandler(async (req: Request, res: Response) => {
  const ctx = contextOf(req);
  const body = req.body as z.infer<typeof AddFormTeamMemberBodySchema>;
  const membershipId = await addFormTeamMember({
    workspaceId: ctx.workspaceId,
    formId: ctx.formId,
    userId: body.userId,
    groupIds: body.groupIds,
    actorId: ctx.actorId,
    displayLabel: ctx.actorDisplayLabel,
  });
  res.status(201).json(await memberOrNotFound(ctx, membershipId));
});

export const setTeamGroups = asyncHandler(async (req: Request, res: Response) => {
  const ctx = contextOf(req);
  const body = req.body as z.infer<typeof SetFormTeamGroupsBodySchema>;
  await setFormTeamGroups({
    workspaceId: ctx.workspaceId,
    formId: ctx.formId,
    membershipId: req.params.membershipId,
    groupIds: body.groupIds,
    displayLabel: ctx.actorDisplayLabel,
  });
  res.json(await memberOrNotFound(ctx, req.params.membershipId));
});

export const removeTeamMember = asyncHandler(async (req: Request, res: Response) => {
  const ctx = contextOf(req);
  await setFormTeamGroups({
    workspaceId: ctx.workspaceId,
    formId: ctx.formId,
    membershipId: req.params.membershipId,
    groupIds: [],
    displayLabel: ctx.actorDisplayLabel,
  });
  res.status(204).end();
});
