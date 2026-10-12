jest.mock('../../src/core/middleware/requireFeature', () => ({
  requireFeature: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../src/features/files/service', () => ({
  filesService: { upload: jest.fn(), getForCaller: jest.fn(), deleteForCaller: jest.fn() },
}));
jest.mock('../../src/features/document-generation/service', () => ({
  documentGenerationService: { listTemplates: jest.fn(), preview: jest.fn(), print: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import { filesRouter } from '../../src/features/files/route';
import { filesService } from '../../src/features/files/service';
import { documentGenerationRouter } from '../../src/features/document-generation/route';
import { documentGenerationService } from '../../src/features/document-generation/service';
import { coreErrorHandler } from '../../src/core/middleware/errorHandler';

const files = jest.mocked(filesService);
const documents = jest.mocked(documentGenerationService);

// The routers and controllers are real; the services they call answer 'denied'.
function buildApp(caller: 'signedIn' | 'anonymous') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (caller === 'signedIn') {
      req.user = { providerCode: 'idir', profile: {} } as unknown as Express.User;
      req.actorId = 'u1';
    } else {
      req.actorId = 'public-user';
      req.idpType = 'public';
    }
    next();
  });
  app.use('/files', filesRouter);
  app.use('/submissions', documentGenerationRouter);
  app.use(coreErrorHandler);
  return app;
}

const submissionId = '01a12d03-75a8-73bc-a106-ce3787ee9a1e';

beforeEach(() => {
  jest.resetAllMocks();
  files.getForCaller.mockResolvedValue('denied');
  files.deleteForCaller.mockResolvedValue('denied');
  documents.listTemplates.mockResolvedValue({ status: 'denied' });
  documents.print.mockResolvedValue({ status: 'denied' });
});

describe('file and document refusals carry a code', () => {
  it.each([
    ['a file download', 'get', '/files/f1', 'read_denied'],
    ['a file delete', 'delete', '/files/f1', 'write_denied'],
    ['a template list', 'get', `/submissions/${submissionId}/templates`, 'render_denied'],
  ] as const)('refuses %s with %s', async (_label, method, path, code) => {
    const signedIn = await request(buildApp('signedIn'))[method](path);
    expect(signedIn.status).toBe(403);
    expect(signedIn.body.code).toBe(code);
    const anonymous = await request(buildApp('anonymous'))[method](path);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.code).toBe(code);
  });

  it('refuses a print with render_denied', async () => {
    const res = await request(buildApp('signedIn'))
      .post(`/submissions/${submissionId}/print`)
      .send({ templateId: submissionId });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('render_denied');
  });
});
