import express from 'express';
import request from 'supertest';

jest.mock('../../../src/core/middleware/requireFeature', () => ({
  requireFeature: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/core/middleware/rateLimit', () => ({
  renderRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/core/middleware/actor', () => ({
  resolveCaller: () => ({ actorId: 'actor1', idpCode: 'idir' }),
}));
// accessDenial needs only the request; its module's repo imports would reach for the database.
jest.mock('../../../src/core/middleware/formSubmitAccess', () => {
  const { ForbiddenError, UnauthorizedError } = jest.requireActual('../../../src/core/errors');
  return {
    accessDenial: (req: express.Request, message: string) =>
      req.user ? new ForbiddenError(message) : new UnauthorizedError(message),
  };
});
jest.mock('../../../src/features/document-generation/service', () => ({
  documentGenerationService: {
    listTemplates: jest.fn(),
    print: jest.fn(),
    printUpload: jest.fn(),
  },
}));

import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';
import { documentGenerationRouter } from '../../../src/features/document-generation/route';
import { documentGenerationService } from '../../../src/features/document-generation/service';

const SUBMISSION = '01a0dc24-1f2e-7a3b-8c4d-5e6f7a8b9c0d';
const printUpload = documentGenerationService.printUpload as jest.Mock;

const app = express();
app.use(express.json());
app.use('/submissions', documentGenerationRouter);
app.use(coreErrorHandler);

const ok = {
  status: 'ok',
  code: 'cdogs-v3',
  data: Buffer.from('doc'),
  contentType: 'application/pdf',
};

const postUpload = (filename = 't.docx') =>
  request(app)
    .post(`/submissions/${SUBMISSION}/print/upload`)
    .attach('file', Buffer.from('template'), filename);

beforeEach(() => {
  jest.clearAllMocks();
  printUpload.mockResolvedValue(ok);
});

describe('POST /:id/print/upload', () => {
  it('streams the rendered document as an attachment', async () => {
    const res = await postUpload();
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(printUpload).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        submissionId: SUBMISSION,
        template: { content: Buffer.from('template'), fileType: 'docx', filename: 't.docx' },
      }),
    );
  });

  it('refuses a file type a CDOGS template does not accept with 415', async () => {
    const res = await postUpload('t.pdf');
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'Template must be one of: docx, xlsx, html' });
    expect(printUpload).not.toHaveBeenCalled();
  });

  it('refuses a request without a file with 400', async () => {
    const res = await request(app).post(`/submissions/${SUBMISSION}/print/upload`).field('x', 'y');
    expect(res.status).toBe(400);
    expect(printUpload).not.toHaveBeenCalled();
  });

  it('refuses an infected template with 422', async () => {
    printUpload.mockResolvedValue({ status: 'infected' });
    const res = await postUpload();
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'File failed virus scan' });
  });

  it('answers 503 when the virus scan cannot run', async () => {
    printUpload.mockResolvedValue({ status: 'scan-unavailable' });
    const res = await postUpload();
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Virus scanning unavailable' });
  });
});
