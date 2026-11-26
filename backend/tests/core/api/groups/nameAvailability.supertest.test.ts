import express from 'express';
import request from 'supertest';

jest.mock('../../../../src/core/middleware/workspaceContext', () => {
  const resolve = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.coreContext = {
      workspaceId: 'ws1',
      actorId: 'actor1',
      actorDisplayLabel: 'Actor One',
      workspaceSource: 'test',
      role: req.header('x-test-role') ?? 'admin',
    };
    next();
  };
  return { workspaceFromResource: () => resolve };
});
jest.mock('../../../../src/core/db/repos/workspaceGroupRepo', () => ({
  groupNameExistsInWorkspace: jest.fn(),
  getWorkspaceGroup: jest.fn(),
}));

import { groupsRouter } from '../../../../src/core/api/groups';
import {
  getWorkspaceGroup,
  groupNameExistsInWorkspace,
} from '../../../../src/core/db/repos/workspaceGroupRepo';
import { coreErrorHandler } from '../../../../src/core/middleware/errorHandler';

const CHECK = '/workspaces/01a0dc24-1f2e-7a3b-8c4d-5e6f7a8b9c0d/groups/name-availability';
const GROUP_ID = '01a0f8f4-0625-701d-a41e-648bc7ae9c7e';

const app = express();
app.use(express.json());
app.use('/', groupsRouter);
app.use(coreErrorHandler);

describe('GET /workspaces/:id/groups/name-availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(groupNameExistsInWorkspace).mockResolvedValue(false);
  });

  it.each([
    [false, true],
    [true, false],
  ])('answers a taken name (%s) as available: %s', async (taken, available) => {
    jest.mocked(groupNameExistsInWorkspace).mockResolvedValue(taken);
    const res = await request(app).get(CHECK).query({ name: '  Reviewers  ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available });
    // Trimmed, as a save trims it, in the caller's workspace.
    expect(groupNameExistsInWorkspace).toHaveBeenCalledWith('ws1', 'Reviewers', undefined);
  });

  it('leaves out the group being renamed', async () => {
    const res = await request(app).get(CHECK).query({ name: 'Reviewers', excludeId: GROUP_ID });
    expect(res.status).toBe(200);
    expect(groupNameExistsInWorkspace).toHaveBeenCalledWith('ws1', 'Reviewers', GROUP_ID);
  });

  it('is not read as a group id', async () => {
    await request(app).get(CHECK).query({ name: 'Reviewers' });
    expect(getWorkspaceGroup).not.toHaveBeenCalled();
  });

  it.each([
    ['a blank name', { name: '   ' }],
    ['a group id that is not a uuid', { name: 'Reviewers', excludeId: 'grp-1' }],
  ])('refuses %s', async (_case, query) => {
    const res = await request(app).get(CHECK).query(query);
    expect(res.status).toBe(400);
    expect(groupNameExistsInWorkspace).not.toHaveBeenCalled();
  });

  it.each(['member', 'viewer'])('refuses a %s, who could not save the group', async (role) => {
    const res = await request(app).get(CHECK).set('x-test-role', role).query({ name: 'Reviewers' });
    expect(res.status).toBe(403);
    expect(groupNameExistsInWorkspace).not.toHaveBeenCalled();
  });
});
