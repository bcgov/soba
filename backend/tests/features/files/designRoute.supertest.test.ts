import express from 'express';
import request from 'supertest';

const mockPermissionCalls: string[][] = [];

jest.mock('../../../src/core/middleware/requireFormPermissions', () => ({
  requireFormPermissions: (required: readonly string[]) => {
    mockPermissionCalls.push([...required]);
    return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
  },
}));

jest.mock('../../../src/core/middleware/workspaceContext', () => ({
  workspaceFromResource:
    () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.coreContext = { actorId: 'staff-1', workspaceId: 'ws1' } as unknown as NonNullable<
        typeof req.coreContext
      >;
      next();
    },
}));

jest.mock('../../../src/core/middleware/requireFeature', () => ({
  requireFeature: () => (_req: unknown, _res: unknown, next: express.NextFunction) => next(),
}));

jest.mock('../../../src/features/files/service', () => ({
  filesService: { getForSubmission: jest.fn() },
}));

jest.mock('../../../src/core/api/shared/sendStoredFile', () => ({
  sendStoredFile: jest.fn(
    async (res: express.Response, _record: unknown, _file: unknown, d: string) => {
      res.status(200).send(d);
    },
  ),
}));

import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';
import { Permissions } from '../../../src/core/db/codes';
import { filesDesignRouter } from '../../../src/features/files/designRoute';
import { filesService } from '../../../src/features/files/service';

const getForSubmission = filesService.getForSubmission as jest.Mock;

const app = express();
app.use(filesDesignRouter);
app.use(coreErrorHandler);

const SUBMISSION_ID = '0199f6a0-0000-7000-8000-000000000001';
const FILE_ID = '0199f6a0-0000-7000-8000-000000000002';
const PATH = `/submissions/${SUBMISSION_ID}/files/${FILE_ID}`;

describe('staff submission file download', () => {
  beforeEach(() => jest.clearAllMocks());

  it('needs submission_read on the form', () => {
    expect(mockPermissionCalls).toEqual([[Permissions.submission_read]]);
  });

  it('sends the file as an attachment', async () => {
    getForSubmission.mockResolvedValue({ record: {}, file: {} });

    const response = await request(app).get(PATH);

    expect(response.status).toBe(200);
    expect(response.text).toBe('attachment');
    expect(getForSubmission).toHaveBeenCalledWith('ws1', SUBMISSION_ID, FILE_ID);
  });

  it('answers 404 for a file not attached to the submission', async () => {
    getForSubmission.mockResolvedValue('notfound');

    expect((await request(app).get(PATH)).status).toBe(404);
  });

  it('answers 503 when the stored bytes are gone', async () => {
    getForSubmission.mockResolvedValue('unavailable');

    expect((await request(app).get(PATH)).status).toBe(503);
  });

  it('refuses ids that are not uuids', async () => {
    expect((await request(app).get('/submissions/x/files/y')).status).toBe(400);
  });
});
