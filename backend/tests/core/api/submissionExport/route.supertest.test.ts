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

// Stands in for resolving the form's workspace, which reads the database.
jest.mock('../../../../src/core/middleware/workspaceContext', () => ({
  workspaceFromResource:
    () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.coreContext = { actorId: 'staff-1', workspaceId: 'ws1' } as unknown as NonNullable<
        typeof req.coreContext
      >;
      next();
    },
}));

jest.mock('../../../../src/core/services/submissionExport/service', () => ({
  submissionExportService: { fields: jest.fn(), export: jest.fn() },
}));

import { coreErrorHandler } from '../../../../src/core/middleware/errorHandler';
import { Permissions } from '../../../../src/core/db/codes';
import { submissionExportRouter } from '../../../../src/core/api/submissionExport/route';
import { submissionExportService } from '../../../../src/core/services/submissionExport/service';

const fields = submissionExportService.fields as jest.Mock;
const exportFile = submissionExportService.export as jest.Mock;

const app = express();
app.use(express.json());
app.use(submissionExportRouter);
app.use(coreErrorHandler);

const FORM_ID = '0199f6a0-0000-7000-8000-000000000001';

describe('submission export routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('gate both routes on form_read and submission_read, as CHEFS 1 does', () => {
    expect(mockPermissionCalls).toEqual([[Permissions.form_read, Permissions.submission_read]]);
  });

  it('answers the field list with the defaults applied', async () => {
    fields.mockResolvedValue({ fields: ['form.submissionId'], lastExportedAt: null });

    const response = await request(app).post(`/forms/${FORM_ID}/export/fields`).send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ fields: ['form.submissionId'], lastExportedAt: null });
    expect(fields).toHaveBeenCalledWith(
      { workspaceId: 'ws1', formId: FORM_ID, actorId: 'staff-1' },
      expect.objectContaining({
        dateMode: 'sinceLastExport',
        includeDrafts: false,
        template: 'multiRowEmptySpacesCSVExport',
      }),
    );
  });

  it('sends the file as an attachment, with links based on the caller origin and locale', async () => {
    exportFile.mockResolvedValue({
      filename: 'housing_submissions.csv',
      contentType: 'text/csv',
      body: '"a"\n"b"',
    });

    const response = await request(app)
      .post(`/forms/${FORM_ID}/export`)
      .set('Origin', 'https://app.example')
      .send({ format: 'csv', locale: 'fr' });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toContain(
      'attachment; filename="housing_submissions.csv"',
    );
    expect(response.text).toBe('"a"\n"b"');
    expect(exportFile.mock.calls[0][2]).toBe('https://app.example/fr');
  });

  it.each([
    ['a range without dates', { dateMode: 'range' }],
    [
      'a range that ends before it starts',
      { dateMode: 'range', from: '2026-10-02T00:00:00Z', to: '2026-10-01T00:00:00Z' },
    ],
    ['an unknown layout', { template: 'fancy' }],
  ])('refuses %s', async (_label, body) => {
    const response = await request(app).post(`/forms/${FORM_ID}/export`).send(body);

    expect(response.status).toBe(400);
    expect(exportFile).not.toHaveBeenCalled();
  });

  it('refuses a form id that is not a uuid', async () => {
    const response = await request(app).post('/forms/not-a-uuid/export/fields').send({});

    expect(response.status).toBe(400);
  });
});
