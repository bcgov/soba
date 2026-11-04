import express from 'express';
import request from 'supertest';

// Records what each route asks for; the real middleware reads permissions from the database.
const mockPermissionCalls: string[][] = [];
jest.mock('../../../../src/core/middleware/requireFormPermissions', () => ({
  requireFormPermissions: (required: readonly string[]) => {
    mockPermissionCalls.push([...required]);
    return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
  },
}));

// Stands in for resolving the form's workspace, which reads the database.
jest.mock('../../../../src/core/middleware/workspaceContext', () => ({
  workspaceFromResource:
    () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.coreContext = {
        workspaceId: 'ws1',
        formId: 'f1',
        actorId: 'actor1',
        actorDisplayLabel: 'Actor One',
      } as unknown as NonNullable<typeof req.coreContext>;
      next();
    },
}));

const mockRepo = {
  listFormTeam: jest.fn(),
  listFormTeamGroups: jest.fn(),
  getFormTeamMember: jest.fn(),
  addFormTeamMember: jest.fn(),
  setFormTeamGroups: jest.fn(),
};
jest.mock('../../../../src/core/db/repos/formTeamRepo', () => ({
  listFormTeam: (...args: unknown[]) => mockRepo.listFormTeam(...args),
  listFormTeamGroups: (...args: unknown[]) => mockRepo.listFormTeamGroups(...args),
  getFormTeamMember: (...args: unknown[]) => mockRepo.getFormTeamMember(...args),
  addFormTeamMember: (...args: unknown[]) => mockRepo.addFormTeamMember(...args),
  setFormTeamGroups: (...args: unknown[]) => mockRepo.setFormTeamGroups(...args),
}));

import { ApiErrorCodes } from '@soba/lib';
import { formTeamRouter } from '../../../../src/core/api/formTeam';
import { ConflictError } from '../../../../src/core/errors';
import { Permissions } from '../../../../src/core/db/codes';
import { coreErrorHandler } from '../../../../src/core/middleware/errorHandler';

const app = express();
app.use(express.json());
app.use('/forms/:id/team', formTeamRouter);
app.use(coreErrorHandler);

const TEAM = '/forms/f1/team';
const USER_ID = '01a0dc24-1f2e-7a3b-8c4d-5e6f7a8b9c02';
const GROUP_ID = '01a0dc24-1f2e-7a3b-8c4d-5e6f7a8b9c01';
const MEMBER = {
  id: 'm-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  groups: [GROUP_ID],
  formOnlyGroups: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.listFormTeam.mockResolvedValue({ items: [MEMBER], total: 1 });
  mockRepo.listFormTeamGroups.mockResolvedValue([{ id: GROUP_ID, name: 'Reviewers' }]);
  mockRepo.getFormTeamMember.mockResolvedValue(MEMBER);
  mockRepo.addFormTeamMember.mockResolvedValue('m-1');
  mockRepo.setFormTeamGroups.mockResolvedValue(undefined);
});

it('gates the reads on team_read and the changes on team_update', () => {
  expect(mockPermissionCalls).toEqual([[Permissions.team_read], [Permissions.team_update]]);
});

it("lists the form's team in its workspace, first page", async () => {
  const res = await request(app).get(TEAM);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    items: [MEMBER],
    page: { offset: 0, limit: expect.any(Number), total: 1 },
    filters: {},
  });
  expect(mockRepo.listFormTeam).toHaveBeenCalledWith(
    expect.objectContaining({ workspaceId: 'ws1', formId: 'f1', offset: 0 }),
  );
});

it('lists the groups a member can be put in', async () => {
  const res = await request(app).get(`${TEAM}/groups`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ items: [{ id: GROUP_ID, name: 'Reviewers' }] });
});

it('adds a person on this form, by the caller, and answers with the member', async () => {
  const res = await request(app)
    .post(TEAM)
    .send({ userId: USER_ID, groupIds: [GROUP_ID] });

  expect(res.status).toBe(201);
  expect(res.body).toEqual(MEMBER);
  expect(mockRepo.addFormTeamMember).toHaveBeenCalledWith({
    workspaceId: 'ws1',
    formId: 'f1',
    userId: USER_ID,
    groupIds: [GROUP_ID],
    actorId: 'actor1',
    displayLabel: 'Actor One',
  });
});

it('says why a person already on the team is refused', async () => {
  mockRepo.addFormTeamMember.mockRejectedValue(
    new ConflictError('on the team', ApiErrorCodes.team_member_exists),
  );
  const res = await request(app)
    .post(TEAM)
    .send({ userId: USER_ID, groupIds: [GROUP_ID] });

  expect(res.status).toBe(409);
  expect(res.body.code).toBe(ApiErrorCodes.team_member_exists);
});

it.each([
  ['no group', { userId: USER_ID, groupIds: [] }],
  ['no user', { groupIds: [GROUP_ID] }],
  ['a user id that is not one', { userId: 'u1', groupIds: [GROUP_ID] }],
])('refuses an add with %s', async (_label, body) => {
  const res = await request(app).post(TEAM).send(body);

  expect(res.status).toBe(400);
  expect(mockRepo.addFormTeamMember).not.toHaveBeenCalled();
});

it("replaces a member's groups on this form", async () => {
  const res = await request(app)
    .put(`${TEAM}/m-1/groups`)
    .send({ groupIds: [GROUP_ID] });

  expect(res.status).toBe(200);
  expect(mockRepo.setFormTeamGroups).toHaveBeenCalledWith(
    expect.objectContaining({ formId: 'f1', membershipId: 'm-1', groupIds: [GROUP_ID] }),
  );
});

it('takes a member off the team by emptying their groups on this form', async () => {
  const res = await request(app).delete(`${TEAM}/m-1`);

  expect(res.status).toBe(204);
  expect(mockRepo.setFormTeamGroups).toHaveBeenCalledWith(
    expect.objectContaining({ formId: 'f1', membershipId: 'm-1', groupIds: [] }),
  );
});

it('refuses to leave the form without a form administrator', async () => {
  mockRepo.setFormTeamGroups.mockRejectedValue(
    new ConflictError('last admin', ApiErrorCodes.last_form_admin),
  );
  const res = await request(app).delete(`${TEAM}/m-1`);

  expect(res.status).toBe(409);
  expect(res.body.code).toBe(ApiErrorCodes.last_form_admin);
});
