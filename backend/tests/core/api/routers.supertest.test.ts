// Feature gates pass, except for codes in mockOff, which refuse as a disabled feature does.
const mockOff = new Set<string>();
jest.mock('../../../src/core/middleware/requireFeature', () => {
  const { NotFoundError } = jest.requireActual('../../../src/core/errors');
  return {
    requireFeature:
      (code: string) => (_req: unknown, _res: unknown, next: (err?: unknown) => void) =>
        next(mockOff.has(code) ? new NotFoundError('Not found', 'route_not_found') : undefined),
  };
});
jest.mock('../../../src/features/files/service', () => ({
  filesService: { upload: jest.fn(), getForCaller: jest.fn(), deleteForCaller: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import { filesApiRouter, submitRouter } from '../../../src/core/api';
import { Features } from '../../../src/core/db/codes';
import { filesService } from '../../../src/features/files/service';

const files = jest.mocked(filesService);

// The routers as index.ts composes them, at their app.ts paths, with a signed-in caller standing in
// for the auth middleware app.ts runs first.
function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { providerCode: 'idir', profile: {} } as unknown as Express.User;
    req.actorId = 'u1';
    next();
  });
  app.use('/api/v1/submit', express.json(), submitRouter);
  app.use('/api/v1/files', filesApiRouter);
  return app;
}

const id = '01a12d03-75a8-73bc-a106-ce3787ee9a1e';

beforeEach(() => {
  jest.resetAllMocks();
  mockOff.clear();
  files.getForCaller.mockResolvedValue('denied');
});

describe('the composed API routers', () => {
  it('serve attachments under /api/v1/files', async () => {
    const res = await request(buildApp()).get(`/api/v1/files/${id}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('read_denied');
    expect(files.getForCaller).toHaveBeenCalledTimes(1);
  });

  it('gate attachments on the files feature', async () => {
    mockOff.add(Features.files);
    const res = await request(buildApp()).get(`/api/v1/files/${id}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('route_not_found');
    expect(files.getForCaller).not.toHaveBeenCalled();
  });

  it('do not serve attachments under /api/v1/submit', async () => {
    const res = await request(buildApp()).get(`/api/v1/submit/files/${id}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('route_not_found');
    expect(files.getForCaller).not.toHaveBeenCalled();
  });

  it('take an email copy request under /api/v1/submit, with document generation off', async () => {
    mockOff.add(Features.document_generation);
    const res = await request(buildApp())
      .post(`/api/v1/submit/submissions/${id}/email-copy`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('request_invalid');
  });
});
