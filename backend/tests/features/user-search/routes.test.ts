import express from 'express';
import request from 'supertest';

// Stands in for workspace resolution, which reads the membership from the database: the caller's
// membership role comes from a test header, and a form route puts the form in context.
jest.mock('../../../src/core/middleware/workspaceContext', () => ({
  workspaceFromResource:
    (config: { kind: string }) =>
    (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.coreContext = {
        workspaceId: 'ws1',
        actorId: 'actor1',
        actorDisplayLabel: 'Actor One',
        workspaceSource: 'test',
        role: req.header('x-test-role') ?? 'member',
        ...(config.kind === 'form' ? { formId: req.params.id } : {}),
      };
      next();
    },
}));
jest.mock('../../../src/core/db/repos/featureRepo', () => ({
  isFeatureEnabledCached: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/formAccessRepo', () => ({
  resolveFormPermissions: jest.fn(),
  resolveWorkspacePermissions: jest.fn(),
}));
jest.mock('../../../src/features/user-search/service', () => ({
  getUserSearchCapabilities: jest.fn(),
  searchUsers: jest.fn(),
}));

import { isFeatureEnabledCached } from '../../../src/core/db/repos/featureRepo';
import {
  resolveFormPermissions,
  resolveWorkspacePermissions,
} from '../../../src/core/db/repos/formAccessRepo';
import { getUserSearchCapabilities, searchUsers } from '../../../src/features/user-search/service';
import { formUserSearchRouter, workspaceUserSearchRouter } from '../../../src/features/user-search';
import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';

const app = express();
app.use('/workspaces/:id/user-search', workspaceUserSearchRouter);
app.use('/forms/:id/user-search', formUserSearchRouter);
app.use(coreErrorHandler);

const FORM_SEARCH = '/forms/form-1/user-search/azureidir';
const WORKSPACE_SEARCH = '/workspaces/ws1/user-search/azureidir';

describe('user search routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isFeatureEnabledCached).mockResolvedValue(true);
    jest.mocked(resolveFormPermissions).mockResolvedValue(new Set());
    jest.mocked(resolveWorkspacePermissions).mockResolvedValue(new Set());
    jest.mocked(searchUsers).mockResolvedValue({ users: [], truncated: false, plugins: [] });
    jest.mocked(getUserSearchCapabilities).mockResolvedValue({ identityProviders: [] });
  });

  it('answers 404 when the feature is off', async () => {
    jest.mocked(isFeatureEnabledCached).mockResolvedValue(false);

    expect(
      (await request(app).get(`${FORM_SEARCH}?email=al`).set('x-test-role', 'owner')).status,
    ).toBe(404);
    expect(
      (await request(app).get('/workspaces/ws1/user-search').set('x-test-role', 'owner')).status,
    ).toBe(404);
    expect(searchUsers).not.toHaveBeenCalled();
  });

  it.each(['owner', 'admin'])(
    'lets a workspace %s search without a permission lookup',
    async (role) => {
      const res = await request(app).get(`${FORM_SEARCH}?email=al`).set('x-test-role', role);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(resolveFormPermissions).not.toHaveBeenCalled();
    },
  );

  it('lets a team_update holder on the form search that form', async () => {
    jest.mocked(resolveFormPermissions).mockResolvedValue(new Set(['team_update']));

    const res = await request(app).get(`${FORM_SEARCH}?email=al`).set('x-test-role', 'member');

    expect(res.status).toBe(200);
    expect(resolveFormPermissions).toHaveBeenCalledWith('actor1', 'ws1', 'form-1');
  });

  it('checks team_update on the workspace for the workspace routes', async () => {
    jest.mocked(resolveWorkspacePermissions).mockResolvedValue(new Set(['team_update']));

    const res = await request(app).get(`${WORKSPACE_SEARCH}?email=al`).set('x-test-role', 'viewer');

    expect(res.status).toBe(200);
    expect(resolveWorkspacePermissions).toHaveBeenCalledWith('actor1', 'ws1');
    expect(resolveFormPermissions).not.toHaveBeenCalled();
  });

  it.each(['member', 'viewer'])('refuses a %s without team_update', async (role) => {
    jest.mocked(resolveFormPermissions).mockResolvedValue(new Set(['form_read', 'team_read']));

    const search = await request(app).get(`${FORM_SEARCH}?email=al`).set('x-test-role', role);
    const capabilities = await request(app)
      .get('/forms/form-1/user-search')
      .set('x-test-role', role);

    expect(search.status).toBe(403);
    expect(capabilities.status).toBe(403);
    expect(searchUsers).not.toHaveBeenCalled();
    expect(getUserSearchCapabilities).not.toHaveBeenCalled();
  });

  it.each([
    ['no filter', ''],
    ['a one-character name', '?firstName=a'],
    ['a one-character guid', '?guid=a'],
    ['a blank filter', '?lastName=%20%20'],
    ['an unknown parameter', '?email=al&workspaceId=ws1'],
    ['a repeated filter', '?email=al&email=bo'],
  ])('rejects %s before searching', async (_case, query) => {
    const res = await request(app).get(`${FORM_SEARCH}${query}`).set('x-test-role', 'owner');

    expect(res.status).toBe(400);
    expect(searchUsers).not.toHaveBeenCalled();
  });

  it('passes the identity provider and trimmed filters to the search', async () => {
    const res = await request(app)
      .get(`${FORM_SEARCH}?firstName=%20Alice%20&guid=F0E1`)
      .set('x-test-role', 'owner')
      .set('accept-language', 'fr-CA');

    expect(res.status).toBe(200);
    expect(searchUsers).toHaveBeenCalledWith(
      'azureidir',
      { firstName: 'Alice', guid: 'F0E1' },
      {},
      'fr',
    );
  });

  it('returns what can be searched', async () => {
    const capabilities = {
      identityProviders: [{ code: 'azureidir', name: 'IDIR - MFA', fields: ['email' as const] }],
    };
    jest.mocked(getUserSearchCapabilities).mockResolvedValue(capabilities);

    const res = await request(app).get('/workspaces/ws1/user-search').set('x-test-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(capabilities);
  });
});
