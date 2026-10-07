import express from 'express';
import request from 'supertest';

// Records what each route asks for; the real middleware reads permissions from the database.
const mockPermissionCalls: string[][] = [];

jest.mock('../../../../src/core/middleware/requireFormPermissions', () => ({
  requireFormPermissions: (required: readonly string[]) => {
    mockPermissionCalls.push([...required]);
    return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
  },
}));

// Stands in for resolving the submission's workspace, which reads the database.
jest.mock('../../../../src/core/middleware/workspaceContext', () => ({
  workspaceListScope: () => (_req: unknown, _res: unknown, next: express.NextFunction) => next(),
  workspaceFromResource:
    () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.coreContext = {
        actorId: 'a1',
        workspaceId: 'ws1',
        actorDisplayLabel: 'Rev Iewer',
      } as unknown as NonNullable<typeof req.coreContext>;
      next();
    },
}));

jest.mock('../../../../src/core/api/submissions/service', () => ({ submissionsApiService: {} }));

import { coreErrorHandler } from '../../../../src/core/middleware/errorHandler';
import { Permissions } from '../../../../src/core/db/codes';
import { designSubmissionsRouter } from '../../../../src/core/api/submissions/route';
import reviewData from '../../../../src/core/api/submissions/reviewData.json';

const app = express();
app.use(express.json());
app.use('/submissions', designSubmissionsRouter);
app.use(coreErrorHandler);

describe('submission review routes', () => {
  it('gates reads on submission_read, status and notes on submission_review, edits on submission_update', () => {
    expect(mockPermissionCalls.slice(-4)).toEqual([
      [Permissions.submission_read],
      [Permissions.submission_review],
      [Permissions.submission_review],
      [Permissions.submission_update],
    ]);
  });

  it('answers a submission nobody has touched with the sample review', async () => {
    const response = await request(app).get('/submissions/untouched/review');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(reviewData);
  });

  it('puts a status change first, under the caller, and keeps the earlier history', async () => {
    const response = await request(app)
      .post('/submissions/sub-status/review/status')
      .send({ status: 'COMPLETED', assignee: null, emailComment: false });

    expect(response.status).toBe(200);
    expect(response.body.statusHistory).toHaveLength(reviewData.statusHistory.length + 1);
    expect(response.body.statusHistory[0]).toMatchObject({
      status: 'COMPLETED',
      assignee: null,
      updatedBy: 'Rev Iewer',
    });
  });

  it('refuses a status the workflow does not have', async () => {
    const response = await request(app)
      .post('/submissions/sub-status/review/status')
      .send({ status: 'ARCHIVED', assignee: null, emailComment: false });

    expect(response.status).toBe(400);
  });

  it('adds a note to one submission without touching another', async () => {
    const response = await request(app)
      .post('/submissions/sub-notes/review/notes')
      .send({ text: '  Needs a second look  ' });
    const other = await request(app).get('/submissions/sub-other/review');

    expect(response.body.notes[0]).toMatchObject({
      text: 'Needs a second look',
      createdBy: 'Rev Iewer',
    });
    expect(other.body.notes).toEqual(reviewData.notes);
  });

  it('refuses an empty note', async () => {
    const response = await request(app)
      .post('/submissions/sub-notes/review/notes')
      .send({ text: ' ' });

    expect(response.status).toBe(400);
  });

  it('records an edit and returns it on the next read', async () => {
    await request(app).post('/submissions/sub-edits/review/edits');
    const response = await request(app).get('/submissions/sub-edits/review');

    expect(response.body.editHistory).toHaveLength(reviewData.editHistory.length + 1);
    expect(response.body.editHistory[0].editedBy).toBe('Rev Iewer');
  });
});
