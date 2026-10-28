import express from 'express';
import request from 'supertest';

// Records what each route asks for, and grants what the x-test-permissions header lists; the real
// middleware reads permissions from the database.
const mockPermissionCalls: string[][] = [];

jest.mock('../../../../src/core/middleware/requireFormPermissions', () => ({
  requireFormPermissions: (required: readonly string[]) => {
    mockPermissionCalls.push([...required]);
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const granted = (req.get('x-test-permissions') ?? '').split(',');
      if (required.every((code) => granted.includes(code))) return next();
      res.status(403).json({ error: 'Forbidden' });
    };
  },
}));

// Stands in for resolving the form's workspace, which reads the database.
jest.mock('../../../../src/core/middleware/workspaceContext', () => ({
  workspaceFromResource:
    () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.coreContext = {
        actorId: req.get('x-test-actor') ?? 'staff-1',
        workspaceId: 'ws1',
      } as unknown as NonNullable<typeof req.coreContext>;
      next();
    },
}));

import { coreErrorHandler } from '../../../../src/core/middleware/errorHandler';
import { Permissions } from '../../../../src/core/db/codes';
import { submissionExportRouter } from '../../../../src/core/api/submissionExport/route';
import exportsData from '../../../../src/core/api/submissionExport/exportsData.json';

const app = express();
app.use(express.json());
app.use(submissionExportRouter);
app.use(coreErrorHandler);

const FORM_ID = '0199f6a0-0000-7000-8000-000000000001';
const OTHER_FORM_ID = '0199f6a0-0000-7000-8000-000000000002';
const EXPORTS = `/forms/${FORM_ID}/exports`;
const UNKNOWN_EXPORT_ID = '0199f6a0-0000-7000-8000-0000000000ff';

const asStaff = (test: request.Test, actor = 'staff-1') =>
  test.set('x-test-permissions', Permissions.submission_read).set('x-test-actor', actor);

describe('submission export routes', () => {
  it('gate every route on submission_read', () => {
    expect(mockPermissionCalls).toEqual([[Permissions.submission_read]]);
  });

  it.each([
    ['the field list', () => request(app).post(`${EXPORTS}/fields`).send({})],
    ['a start', () => request(app).post(EXPORTS).send({})],
    ['the list', () => request(app).get(EXPORTS)],
    ['one export', () => request(app).get(`${EXPORTS}/${exportsData.exports[0].id}`)],
  ])('refuses %s without submission_read', async (_label, send) => {
    const response = await send().set('x-test-permissions', Permissions.form_read);

    expect(response.status).toBe(403);
  });

  it('answers the sample field list', async () => {
    const response = await asStaff(request(app).post(`${EXPORTS}/fields`)).send({
      layout: 'singleRowCSVExport',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ fields: exportsData.fields });
  });

  it('starts a queued export with the filters it was given', async () => {
    const response = await asStaff(request(app).post(EXPORTS), 'starter').send({
      from: '2026-10-01T07:00:00.000Z',
      layout: 'singleRowCSVExport',
      fields: ['applicantName'],
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      formId: FORM_ID,
      format: 'csv',
      from: '2026-10-01T07:00:00.000Z',
      layout: 'singleRowCSVExport',
      fields: ['applicantName'],
      status: 'queued',
    });
  });

  it('lists the sample exports for someone who has not started one', async () => {
    const response = await asStaff(request(app).get(EXPORTS), 'newcomer');

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual(
      exportsData.exports.map((item) => item.id),
    );
    expect(response.body.items[0].formId).toBe(FORM_ID);
  });

  it('lists my new export first, and not to someone else or on another form', async () => {
    const started = await asStaff(request(app).post(EXPORTS), 'mine').send({ format: 'json' });

    const mine = await asStaff(request(app).get(EXPORTS), 'mine');
    const theirs = await asStaff(request(app).get(EXPORTS), 'theirs');
    const otherForm = await asStaff(request(app).get(`/forms/${OTHER_FORM_ID}/exports`), 'mine');

    expect(mine.body.items[0]).toEqual(started.body);
    expect(mine.body.items).toHaveLength(exportsData.exports.length + 1);
    expect(theirs.body.items).toHaveLength(exportsData.exports.length);
    expect(otherForm.body.items).toHaveLength(exportsData.exports.length);
  });

  it('gets one of my exports, and 404 for an unknown one', async () => {
    const started = await asStaff(request(app).post(EXPORTS), 'getter').send({});

    const found = await asStaff(request(app).get(`${EXPORTS}/${started.body.id}`), 'getter');
    const missing = await asStaff(request(app).get(`${EXPORTS}/${UNKNOWN_EXPORT_ID}`), 'getter');

    expect(found.status).toBe(200);
    expect(found.body).toEqual(started.body);
    expect(missing.status).toBe(404);
  });

  it.each([
    [
      'a range that ends before it starts',
      { from: '2026-10-02T00:00:00Z', to: '2026-10-01T00:00:00Z' },
    ],
    ['a date without a time', { from: '2026-10-01' }],
    ['an unknown layout', { layout: 'fancy' }],
    ['an unknown format', { format: 'xlsx' }],
  ])('refuses %s', async (_label, body) => {
    const response = await asStaff(request(app).post(EXPORTS)).send(body);

    expect(response.status).toBe(400);
  });

  it('refuses a form id that is not a uuid', async () => {
    const response = await asStaff(request(app).get('/forms/not-a-uuid/exports'));

    expect(response.status).toBe(400);
  });
});
