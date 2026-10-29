import {
  StartSubmissionExportBodySchema,
  SubmissionExportFieldsBodySchema,
  SubmissionExportSchema,
} from '../../src/schemas/submissionExport';

const FROM = '2026-10-01T00:00:00Z';
const TO = '2026-10-02T00:00:00Z';

describe('StartSubmissionExportBodySchema', () => {
  it('defaults to CSV with no filters', () => {
    expect(StartSubmissionExportBodySchema.parse({})).toEqual({ format: 'csv' });
  });

  it('accepts a range with from before to', () => {
    expect(StartSubmissionExportBodySchema.safeParse({ from: FROM, to: TO }).success).toBe(true);
  });

  it.each([
    ['only from', { from: FROM }],
    ['only to', { to: TO }],
  ])('accepts a half-open range with %s', (_label, body) => {
    expect(StartSubmissionExportBodySchema.safeParse(body).success).toBe(true);
  });

  it.each([
    ['empty', { from: FROM, to: FROM }],
    ['ending before it starts', { from: TO, to: FROM }],
  ])('refuses a range %s', (_label, body) => {
    expect(StartSubmissionExportBodySchema.safeParse(body).success).toBe(false);
  });

  it.each([
    ['format', { format: 'xlsx' }],
    ['layout', { layout: 'fancy' }],
    ['version id', { formVersionId: 'v1' }],
    ['date', { from: '2026-10-01' }],
  ])('refuses an unknown %s', (_label, body) => {
    expect(StartSubmissionExportBodySchema.safeParse(body).success).toBe(false);
  });
});

describe('SubmissionExportFieldsBodySchema', () => {
  it('takes the filters only', () => {
    expect(
      SubmissionExportFieldsBodySchema.parse({ layout: 'singleRowCSVExport', format: 'json' }),
    ).toEqual({ layout: 'singleRowCSVExport' });
  });

  it('refuses a range ending before it starts', () => {
    expect(SubmissionExportFieldsBodySchema.safeParse({ from: TO, to: FROM }).success).toBe(false);
  });
});

describe('SubmissionExportSchema', () => {
  const record = {
    id: 'e1',
    formId: 'f1',
    format: 'csv',
    status: 'queued',
    createdAt: FROM,
  };

  it('accepts a queued export', () => {
    expect(SubmissionExportSchema.safeParse(record).success).toBe(true);
  });

  it('refuses any other status', () => {
    expect(SubmissionExportSchema.safeParse({ ...record, status: 'completed' }).success).toBe(
      false,
    );
  });
});
