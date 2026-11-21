import { Readable } from 'node:stream';
import express from 'express';
import request from 'supertest';

// The real middleware resolves the submission's workspace and form, the caller's access and the
// feature's grants from the database, which these tests are not about. The stand-ins record what the
// route asks for and each gate a request passes through, resolve a fixed workspace and form, refuse
// a request carrying x-deny, and turn the feature off for a request carrying x-feature-off.
const mockPermissionCalls: string[][] = [];
const mockFeatureCalls: { code: string; scope: unknown }[] = [];
const mockGates: string[] = [];

jest.mock('../../../src/core/middleware/workspaceContext', () => ({
  workspaceFromResource:
    () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      mockGates.push('submission');
      req.coreContext = {
        actorId: 'reader',
        workspaceId: 'ws1',
        formId: 'f1',
      } as unknown as NonNullable<typeof req.coreContext>;
      next();
    },
}));

jest.mock('../../../src/core/middleware/requireFormPermissions', () => {
  const { ForbiddenError } = jest.requireActual('../../../src/core/errors');
  return {
    requireFormPermissions: (required: readonly string[]) => {
      mockPermissionCalls.push([...required]);
      return (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        mockGates.push('permissions');
        next(req.get('x-deny') ? new ForbiddenError('Insufficient form permissions') : undefined);
      };
    },
  };
});

jest.mock('../../../src/core/middleware/requireFeatureAvailable', () => {
  const { NotFoundError } = jest.requireActual('../../../src/core/errors');
  return {
    requireFeatureAvailable:
      (code: string, getScope: (req: express.Request) => unknown) =>
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        mockGates.push('feature');
        mockFeatureCalls.push({ code, scope: getScope(req) });
        next(req.get('x-feature-off') ? new NotFoundError('Not found') : undefined);
      },
  };
});

jest.mock('../../../src/features/submission-package/service', () => ({
  submissionPackageService: { openDownload: jest.fn() },
}));

import { ApiErrorCodes } from '@soba/lib';
import { Features, Permissions } from '../../../src/core/db/codes';
import { NotFoundError } from '../../../src/core/errors';
import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';
import { submissionPackageRouter } from '../../../src/features/submission-package/route';
import { submissionPackageService } from '../../../src/features/submission-package/service';

const openDownload = jest.mocked(submissionPackageService.openDownload);

const SUBMISSION_ID = '0199f6a0-0000-7000-8000-000000000001';
const JOB_ID = '0199f6a0-0000-7000-8000-0000000000aa';
const FILE = `/submissions/${SUBMISSION_ID}/packages/${JOB_ID}/file`;
const ZIP = Buffer.from('PK\u0003\u0004 not really a zip');

const app = express();
app.use(submissionPackageRouter);
app.use(coreErrorHandler);

const download = () =>
  request(app)
    .get(FILE)
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    });

describe('submission package route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureCalls.length = 0;
    mockGates.length = 0;
  });

  it("gates the download on submission_read, then the package feature for the submission's workspace and form", async () => {
    openDownload.mockRejectedValue(new NotFoundError('Package not available'));

    await download();

    expect(mockGates).toEqual(['submission', 'permissions', 'feature']);
    expect(mockPermissionCalls).toEqual([[Permissions.submission_read]]);
    expect(mockFeatureCalls).toEqual([
      { code: Features.post_submission_email_package, scope: { workspaceId: 'ws1', formId: 'f1' } },
    ]);
  });

  it('refuses a caller without access before saying whether packages are on', async () => {
    const response = await download().set('x-deny', '1').set('x-feature-off', '1');

    expect(response.status).toBe(403);
    expect(mockFeatureCalls).toEqual([]);
    expect(openDownload).not.toHaveBeenCalled();
  });

  it('answers 404 while packages are off for the form', async () => {
    const response = await download().set('x-feature-off', '1');

    expect(response.status).toBe(404);
    expect(openDownload).not.toHaveBeenCalled();
  });

  it('streams a ready package as an attachment of opaque bytes, for the caller on the submission', async () => {
    openDownload.mockResolvedValue({
      state: 'ready',
      file: {
        id: 'file-1',
        filename: 'Permit ABC123.zip',
        contentType: 'application/zip',
        size: ZIP.length,
      },
      content: { downloadStream: Readable.from([ZIP]), size: ZIP.length },
    } as never);

    const response = await download();

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/octet-stream');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain('Permit ABC123.zip');
    expect(Buffer.compare(response.body as Buffer, ZIP)).toBe(0);
    expect(openDownload).toHaveBeenCalledWith(
      { actorId: 'reader', workspaceId: 'ws1', formId: 'f1', submissionId: SUBMISSION_ID },
      JOB_ID,
    );
  });

  it('answers 404 with file_not_found when the package is not available', async () => {
    openDownload.mockRejectedValue(
      new NotFoundError('Package not available', ApiErrorCodes.file_not_found),
    );

    const response = await request(app).get(FILE);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ApiErrorCodes.file_not_found);
  });

  it.each([
    ['a submission id', `/submissions/not-a-uuid/packages/${JOB_ID}/file`],
    ['a job id', `/submissions/${SUBMISSION_ID}/packages/latest/file`],
  ])('refuses %s that is not a UUID before any gate', async (_label, path) => {
    const response = await request(app).get(path).set('x-deny', '1');

    expect(response.status).toBe(400);
    expect(mockGates).toEqual([]);
    expect(openDownload).not.toHaveBeenCalled();
  });

  it('passes the ids on in lower case', async () => {
    openDownload.mockRejectedValue(new NotFoundError('Package not available'));

    await request(app).get(
      `/submissions/${SUBMISSION_ID.toUpperCase()}/packages/${JOB_ID.toUpperCase()}/file`,
    );

    expect(openDownload).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: SUBMISSION_ID }),
      JOB_ID,
    );
  });
});
