import express from 'express';
import request from 'supertest';
jest.mock('../../../../src/core/middleware/workspaceContext', () => ({
  workspaceFromResource:
    () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.coreContext = {
        workspaceId: 'workspace',
        formId: req.params.id,
        actorId: 'actor',
        actorDisplayLabel: 'Actor',
        workspaceSource: 'test',
        role: 'member',
      };
      next();
    },
}));
jest.mock('../../../../src/core/db/repos/formAccessRepo', () => ({
  resolveFormPermissions: jest.fn(),
}));
jest.mock('../../../../src/core/api/form-team/service', () => ({
  formTeamService: {
    add: jest.fn(),
    list: jest.fn(),
    groups: jest.fn(),
    candidates: jest.fn(),
    setGroups: jest.fn(),
  },
}));

import { formTeamRouter } from '../../../../src/core/api/form-team/route';
import { formTeamService } from '../../../../src/core/api/form-team/service';
import { resolveFormPermissions } from '../../../../src/core/db/repos/formAccessRepo';
import { coreErrorHandler } from '../../../../src/core/middleware/errorHandler';
const formId = '11111111-1111-4111-8111-111111111111';
const groupId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const path = `/forms/${formId}/team`;
const app = express();
app.use(express.json());
app.use('/forms/:id/team', formTeamRouter);
app.use(coreErrorHandler);
const body = { membershipId: '44444444-4444-4444-8444-444444444444', groups: [groupId] };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(resolveFormPermissions).mockResolvedValue(new Set(['team_update']));
});

it('requires team_update even for list reads and every mutation', async () => {
  jest.mocked(resolveFormPermissions).mockResolvedValue(new Set(['team_read']));
  expect((await request(app).get(path)).status).toBe(403);
  expect((await request(app).get(`${path}/candidates`)).status).toBe(403);
  expect((await request(app).post(path).send(body)).status).toBe(403);
  expect(
    (
      await request(app)
        .put(`${path}/${userId}/groups`)
        .send({ groups: [groupId] })
    ).status,
  ).toBe(403);
  expect((await request(app).delete(`${path}/${userId}`)).status).toBe(403);
  expect(formTeamService.add).not.toHaveBeenCalled();
});

it('validates workspace memberships and requires at least one in-scope group id', async () => {
  for (const invalid of [
    { ...body, groups: [] },
    { ...body, groups: ['bad-id'] },
    { ...body, userId },
    { ...body, membershipId: 'bad-id' },
    { groups: [groupId], identityProvider: 'idir', subject: 'jane@idir', lookup: { guid: 'jane' } },
  ]) {
    expect((await request(app).post(path).send(invalid)).status).toBe(400);
  }
  expect(formTeamService.add).not.toHaveBeenCalled();
});

it('passes the resolved form context and selected membership to the save service', async () => {
  expect((await request(app).post(path).send(body)).status).toBe(200);
  expect(formTeamService.add).toHaveBeenCalledWith(
    expect.objectContaining({
      workspaceId: 'workspace',
      formId,
      actorId: 'actor',
      permissions: new Set(['team_update']),
    }),
    body,
  );
});

it('searches workspace candidates under form team permissions', async () => {
  jest
    .mocked(formTeamService.candidates)
    .mockResolvedValue({ items: [], page: { offset: 0, limit: 20, total: 0 } });
  expect((await request(app).get(`${path}/candidates?q=Jane`)).status).toBe(200);
  expect(formTeamService.candidates).toHaveBeenCalledWith(
    expect.objectContaining({ formId }),
    expect.objectContaining({ q: 'Jane' }),
    'en',
  );
});

it('removes assignments for this form and returns no content', async () => {
  expect((await request(app).delete(`${path}/${userId}`)).status).toBe(204);
  expect(formTeamService.setGroups).toHaveBeenCalledWith(
    expect.objectContaining({ formId }),
    userId,
    [],
  );
});

it('accepts a Soba user id without a workspace membership id', async () => {
  const input = { userId, groups: [groupId] };
  expect((await request(app).post(path).send(input)).status).toBe(200);
  expect(formTeamService.add).toHaveBeenCalledWith(expect.anything(), input);
});
