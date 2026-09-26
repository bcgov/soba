import express from 'express';
import request from 'supertest';

// Records the permissions each request asks for and grants only mockGranted. The real middleware
// resolves permissions from the database, which these tests are not about.
const mockAsked: string[][] = [];
const mockGranted = new Set<string>();

jest.mock('../../../src/core/middleware/requireFormPermissions', () => {
  const { ForbiddenError } = jest.requireActual('../../../src/core/errors');
  return {
    requireFormPermissions:
      (required: readonly string[]) =>
      (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
        mockAsked.push([...required]);
        const granted = required.every((p) => mockGranted.has(p));
        next(granted ? undefined : new ForbiddenError('Insufficient form permissions'));
      },
  };
});
jest.mock('../../../src/core/middleware/requireFeature', () => ({
  requireFeature: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/core/middleware/workspaceContext', () => ({
  workspaceFromResource:
    () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.coreContext = {
        workspaceId: 'ws1',
        formId: 'form1',
        actorId: 'actor1',
      } as unknown as NonNullable<typeof req.coreContext>;
      next();
    },
}));
const mockLiveVersion = jest.fn();
jest.mock('../../../src/core/db/repos/formVersionRepo', () => ({
  isLiveFormVersion: (...args: unknown[]) => mockLiveVersion(...args),
}));
jest.mock('../../../src/features/templates/service', () => ({
  templatesService: {
    list: jest.fn(),
    get: jest.fn(),
    open: jest.fn(),
    create: jest.fn(),
    replaceFile: jest.fn(),
    rename: jest.fn(),
    remove: jest.fn(),
  },
}));

import { Permissions } from '../../../src/core/db/codes';
import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';
import { templatesRouter } from '../../../src/features/templates/route';
import { templatesService } from '../../../src/features/templates/service';

const VERSION = '01a0dc25-6c98-74fe-a5fb-91bafb93ccbc';
const TEMPLATE = '01a0dc26-a35e-75c4-bff6-4cdaa9b2b274';

const app = express();
app.use(express.json());
app.use('/templates', templatesRouter);
app.use(coreErrorHandler);

const send = (method: string, url: string) => {
  const agent = request(app);
  switch (method) {
    case 'POST':
      return agent.post(url).attach('file', Buffer.from('x'), 't.docx').field('name', 'Receipt');
    case 'PUT':
      return agent.put(url).attach('file', Buffer.from('x'), 't.docx');
    case 'PATCH':
      return agent.patch(url).send({ name: 'Summary' });
    case 'DELETE':
      return agent.delete(url);
    default:
      return agent.get(url);
  }
};

describe('templates routes', () => {
  beforeEach(() => {
    mockAsked.length = 0;
    mockGranted.clear();
    jest.clearAllMocks();
    mockLiveVersion.mockResolvedValue(true);
  });

  it.each([
    ['GET', `/templates?formVersionId=${VERSION}`, Permissions.document_template_read],
    ['POST', `/templates?formVersionId=${VERSION}`, Permissions.document_template_create],
    ['GET', `/templates/${TEMPLATE}`, Permissions.document_template_read],
    ['GET', `/templates/${TEMPLATE}/content`, Permissions.document_template_read],
    ['PUT', `/templates/${TEMPLATE}/content`, Permissions.document_template_create],
    ['PATCH', `/templates/${TEMPLATE}`, Permissions.document_template_create],
    ['DELETE', `/templates/${TEMPLATE}`, Permissions.document_template_delete],
  ])('%s %s requires %s', async (method, url, permission) => {
    const res = await send(method, url);
    expect(res.status).toBe(403);
    expect(mockAsked).toEqual([[permission]]);
  });

  it('refuses an upload before its body is read', async () => {
    const res = await request(app)
      .post(`/templates?formVersionId=${VERSION}`)
      .set('Content-Type', 'multipart/form-data')
      .send('not multipart');
    expect(res.status).toBe(403);
  });

  it('refuses a file that is not a template type', async () => {
    mockGranted.add(Permissions.document_template_create);
    const res = await request(app)
      .post(`/templates?formVersionId=${VERSION}`)
      .field('name', 'Receipt')
      .attach('file', Buffer.from('x'), 'receipt.pdf');
    expect(res.status).toBe(415);
    expect(templatesService.create).not.toHaveBeenCalled();
  });

  it.each([
    ['a template id', '/templates/engine'],
    ['a form version id', '/templates?formVersionId=engine'],
  ])('rejects %s that is not a uuid before any permission check', async (_what, url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(400);
    expect(mockAsked).toEqual([]);
  });

  it.each([
    ['GET', `/templates?formVersionId=${VERSION}`],
    ['POST', `/templates?formVersionId=${VERSION}`],
  ])(
    'returns 404 on %s for a version whose form is deleted, before any upload',
    async (method, url) => {
      Object.values(Permissions).forEach((p) => mockGranted.add(p));
      mockLiveVersion.mockResolvedValue(false);
      const res = await send(method, url);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Form version not found' });
      expect(templatesService.list).not.toHaveBeenCalled();
      expect(templatesService.create).not.toHaveBeenCalled();
    },
  );

  it('answers a caller without permission 403, whether or not the form is deleted', async () => {
    mockLiveVersion.mockResolvedValue(false);
    const res = await send('GET', `/templates?formVersionId=${VERSION}`);
    expect(res.status).toBe(403);
    expect(mockLiveVersion).not.toHaveBeenCalled();
  });

  it('refuses a template file name over 255 bytes with 400', async () => {
    Object.values(Permissions).forEach((p) => mockGranted.add(p));
    const res = await request(app)
      .post(`/templates?formVersionId=${VERSION}`)
      .attach('file', Buffer.from('x'), `${'a'.repeat(252)}.docx`)
      .field('name', 'Receipt');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'File name is longer than 255 bytes' });
    expect(templatesService.create).not.toHaveBeenCalled();
  });
});
