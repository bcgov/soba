jest.mock('../../../../src/core/api/submissions/service', () => ({
  submissionsApiService: { listMine: jest.fn() },
}));
jest.mock('../../../../src/core/db/repos/featureRepo', () => ({
  isFeatureEnabledCached: jest.fn(),
}));

import express from 'express';
import request from 'supertest';
import { meRouter } from '../../../../src/core/api/me';
import { submissionsApiService } from '../../../../src/core/api/submissions/service';
import { isFeatureEnabledCached } from '../../../../src/core/db/repos/featureRepo';
import { coreErrorHandler } from '../../../../src/core/middleware/errorHandler';

const listMine = jest.mocked(submissionsApiService.listMine);
const featureEnabled = jest.mocked(isFeatureEnabledCached);

// Stands in for checkJwt + resolveActor, which need a signed token; everything after is real.
function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { idpAttributes: {} } as Express.User;
    req.actorId = 'actor-1';
    next();
  });
  app.use('/api/v1', meRouter);
  app.use(coreErrorHandler);
  return app;
}

const PAGE = {
  items: [],
  page: { offset: 0, limit: 20, total: 0 },
  filters: {},
  sort: 'updatedAt:desc' as const,
};

beforeEach(() => {
  listMine.mockReset().mockResolvedValue(PAGE);
  featureEnabled.mockReset().mockResolvedValue(true);
});

describe('GET /me/submissions', () => {
  it("lists the caller's own submissions, never a user named in the query", async () => {
    const res = await request(buildApp())
      .get('/api/v1/me/submissions')
      .query({ workflowState: 'draft', q: 'tax', userId: 'someone-else' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(PAGE);
    expect(listMine).toHaveBeenCalledWith('actor-1', {
      offset: 0,
      limit: 20,
      workflowState: 'draft',
      q: 'tax',
      sort: 'updatedAt:desc',
      locale: 'en',
    });
  });

  it('sorts in the language the caller asks for', async () => {
    await request(buildApp())
      .get('/api/v1/me/submissions')
      .set('Accept-Language', 'fr-CA')
      .query({ sort: 'formName:asc' });

    expect(listMine).toHaveBeenCalledWith(
      'actor-1',
      expect.objectContaining({ sort: 'formName:asc', locale: 'fr' }),
    );
  });

  it.each([
    ['an opened state', { workflowState: 'opened' }],
    ['a deleted state', { workflowState: 'deleted' }],
    ['a cursor', { cursor: 'abc' }],
    ['an unknown sort', { sort: 'confirmationCode:asc' }],
  ])('refuses %s', async (_label, params) => {
    const res = await request(buildApp()).get('/api/v1/me/submissions').query(params);

    expect(res.status).toBe(400);
    expect(listMine).not.toHaveBeenCalled();
  });

  it('is not found while submit mode is off', async () => {
    featureEnabled.mockResolvedValue(false);

    const res = await request(buildApp()).get('/api/v1/me/submissions');

    expect(res.status).toBe(404);
    expect(listMine).not.toHaveBeenCalled();
  });
});
