import { submissionExportService } from '../../../../src/core/services/submissionExport/service';
import * as formRepo from '../../../../src/core/db/repos/formRepo';
import * as submissionRepo from '../../../../src/core/db/repos/submissionRepo';
import * as exportRepo from '../../../../src/core/db/repos/submissionExportRepo';
import * as registry from '../../../../src/core/integrations/form-engine/FormEngineRegistry';
import * as engineSchema from '../../../../src/core/services/engineSchema';
import * as publicUser from '../../../../src/core/services/publicUser';
import type { SubmissionExportBody } from '@soba/lib';

jest.mock('../../../../src/core/db/client', () => ({ db: {} }));
jest.mock('../../../../src/core/db/repos/formRepo', () => ({ getFormById: jest.fn() }));
jest.mock('../../../../src/core/db/repos/submissionRepo', () => ({
  listSubmissionsForExport: jest.fn(),
}));
jest.mock('../../../../src/core/db/repos/submissionExportRepo', () => ({
  getLastExportToDate: jest.fn(),
  recordSubmissionExport: jest.fn(),
}));
jest.mock('../../../../src/core/integrations/form-engine/FormEngineRegistry', () => ({
  createFormEngineAdapter: jest.fn(),
}));
jest.mock('../../../../src/core/services/engineSchema', () => ({ readEngineSchema: jest.fn() }));
jest.mock('../../../../src/core/services/publicUser', () => ({ getPublicUser: jest.fn() }));

const getForm = formRepo.getFormById as unknown as jest.Mock;
const listRows = submissionRepo.listSubmissionsForExport as unknown as jest.Mock;
const getLast = exportRepo.getLastExportToDate as unknown as jest.Mock;
const recordExport = exportRepo.recordSubmissionExport as unknown as jest.Mock;
const createAdapter = registry.createFormEngineAdapter as unknown as jest.Mock;
const readSchema = engineSchema.readEngineSchema as unknown as jest.Mock;
const getPublic = publicUser.getPublicUser as unknown as jest.Mock;

const ctx = { workspaceId: 'ws1', formId: 'f1', actorId: 'staff-1' };

const row = (overrides: Record<string, unknown>) => ({
  id: 's1',
  formVersionId: 'v1',
  versionNo: 1,
  engineSchemaRef: 'schema-1',
  engineSubmissionRef: 'doc-1',
  workflowState: 'submitted',
  confirmationCode: 'ABCD1234',
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  submittedAt: new Date('2026-10-01T10:05:00.000Z'),
  submittedIp: '203.0.113.7',
  submittedUserAgent: 'Mozilla/5.0 (test)',
  submittedBy: 'user-1',
  submitterProfile: {
    displayName: 'Sample Submitter',
    preferredUsername: 'ssubmitter',
    email: 'sample.submitter@example.com',
  },
  ...overrides,
});

const body = (overrides: Partial<SubmissionExportBody> = {}): SubmissionExportBody => ({
  dateMode: 'sinceLastExport',
  includeDrafts: false,
  template: 'multiRowEmptySpacesCSVExport',
  format: 'json',
  locale: 'en',
  ...overrides,
});

const readSubmissions = jest.fn();

describe('submissionExportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getForm.mockResolvedValue({
      id: 'f1',
      name: 'Housing Needs (sample)',
      formEngineCode: 'formio-v5',
    });
    getLast.mockResolvedValue(null);
    getPublic.mockResolvedValue({ id: 'public-user' });
    createAdapter.mockReturnValue({ readSubmissions });
    readSubmissions.mockImplementation((_form: string, refs: string[]) =>
      Promise.resolve(
        new Map(refs.map((ref) => [ref, { data: { name: `answer ${ref}`, submit: true } }])),
      ),
    );
    readSchema.mockImplementation((_engine: string, ref: string) =>
      Promise.resolve({
        components: [
          { type: 'textfield', key: 'name', input: true },
          ...(ref === 'schema-2' ? [{ type: 'textfield', key: 'added', input: true }] : []),
        ],
      }),
    );
  });

  it('exports since the last export, 1 ms after its bound, and records the new bound', async () => {
    getLast.mockResolvedValue(new Date('2026-10-01T00:00:00.000Z'));
    listRows.mockResolvedValue([row({})]);

    await submissionExportService.export(ctx, body(), 'https://app.example/en');

    const query = listRows.mock.calls[0][0];
    expect(query.from).toEqual(new Date('2026-10-01T00:00:00.001Z'));
    expect(query.includeDrafts).toBe(false);
    expect(recordExport).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      formId: 'f1',
      exportedBy: 'staff-1',
      toDate: query.to,
    });
  });

  it('exports everything when the person never exported the form', async () => {
    listRows.mockResolvedValue([]);

    await submissionExportService.export(ctx, body(), '');

    expect(listRows.mock.calls[0][0].from).toBeUndefined();
  });

  it('passes a date range, a version and drafts through', async () => {
    listRows.mockResolvedValue([]);

    await submissionExportService.export(
      ctx,
      body({
        dateMode: 'range',
        from: '2026-09-01T07:00:00.000Z',
        to: '2026-09-30T06:59:59.999Z',
        formVersionId: 'v2',
        includeDrafts: true,
      }),
      '',
    );

    expect(listRows).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      formId: 'f1',
      formVersionId: 'v2',
      includeDrafts: true,
      from: new Date('2026-09-01T07:00:00.000Z'),
      to: new Date('2026-09-30T06:59:59.999Z'),
    });
  });

  it('builds CHEFS 1 shaped records with submitter, IP and user agent, without the submit value', async () => {
    listRows.mockResolvedValue([row({})]);

    const file = await submissionExportService.export(ctx, body(), '');

    expect(file.filename).toBe('housing_needs_sample_submissions.json');
    expect(JSON.parse(file.body)).toEqual([
      {
        form: {
          submissionId: 's1',
          confirmationId: 'ABCD1234',
          formName: 'Housing Needs (sample)',
          version: 1,
          createdAt: '2026-10-01T10:00:00.000Z',
          fullName: 'Sample Submitter',
          username: 'ssubmitter',
          email: 'sample.submitter@example.com',
          submittedAt: '2026-10-01T10:05:00.000Z',
          status: 'submitted',
          ipAddress: '203.0.113.7',
          userAgent: 'Mozilla/5.0 (test)',
        },
        name: 'answer doc-1',
      },
    ]);
  });

  it('shows an anonymous submitter as public, and a draft without a confirmation id', async () => {
    listRows.mockResolvedValue([
      row({ submittedBy: 'public-user', workflowState: 'draft', submittedAt: null }),
    ]);

    const file = await submissionExportService.export(ctx, body(), '');

    expect(JSON.parse(file.body)[0].form).toMatchObject({
      fullName: 'public',
      username: 'public',
      email: null,
      confirmationId: null,
      status: 'draft',
    });
  });

  it('points file urls at the staff download page', async () => {
    listRows.mockResolvedValue([row({})]);
    readSubmissions.mockResolvedValue(
      new Map([
        [
          'doc-1',
          { data: { upload: [{ storage: 'chefs', id: 'file-9', url: '/submit/files/file-9' }] } },
        ],
      ]),
    );

    const file = await submissionExportService.export(ctx, body(), 'https://app.example/en');

    expect(JSON.parse(file.body)[0].upload[0].url).toBe(
      'https://app.example/en/build/f1/submissions/s1/files/file-9',
    );
  });

  it('writes CSV columns across versions, newest version first, and keeps only chosen fields', async () => {
    listRows.mockResolvedValue([
      row({ id: 's2', versionNo: 2, engineSchemaRef: 'schema-2', engineSubmissionRef: 'doc-2' }),
      row({}),
    ]);

    const fields = await submissionExportService.fields(ctx, body());
    expect(fields.fields.slice(-2)).toEqual(['name', 'added']);

    const file = await submissionExportService.export(
      ctx,
      body({ format: 'csv', fields: ['form.submissionId', 'name'] }),
      '',
    );
    expect(file.contentType).toBe('text/csv');
    expect(file.body).toBe('"form.submissionId","name"\n"s2","answer doc-2"\n"s1","answer doc-1"');
  });

  it('reads the field list without recording an export', async () => {
    getLast.mockResolvedValue(new Date('2026-10-02T00:00:00.000Z'));
    listRows.mockResolvedValue([]);

    const result = await submissionExportService.fields(ctx, body());

    expect(result).toEqual({ fields: [], lastExportedAt: '2026-10-02T00:00:00.000Z' });
    expect(recordExport).not.toHaveBeenCalled();
  });

  it('answers not found for a missing form', async () => {
    getForm.mockResolvedValue(null);

    await expect(submissionExportService.export(ctx, body(), '')).rejects.toThrow(/not found/i);
  });

  it('answers form_not_ready, recording nothing, when the engine cannot read in bulk', async () => {
    createAdapter.mockReturnValue({});
    listRows.mockResolvedValue([row({})]);

    await expect(submissionExportService.export(ctx, body(), '')).rejects.toMatchObject({
      code: 'form_not_ready',
    });
    expect(recordExport).not.toHaveBeenCalled();
  });
});
