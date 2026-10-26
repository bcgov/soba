import {
  SubmissionExportBodySchema,
  SubmissionExportFieldsBodySchema,
} from '../../src/schemas/submissionExport';

const FROM = '2026-10-01T00:00:00Z';
const TO = '2026-10-02T00:00:00Z';

describe('SubmissionExportBodySchema', () => {
  it('applies the CHEFS 1 defaults plus since my last export and no drafts', () => {
    expect(SubmissionExportBodySchema.parse({})).toEqual({
      dateMode: 'sinceLastExport',
      includeDrafts: false,
      template: 'multiRowEmptySpacesCSVExport',
      format: 'csv',
      locale: 'en',
    });
  });

  it('accepts a range with from on or before to', () => {
    expect(
      SubmissionExportBodySchema.safeParse({ dateMode: 'range', from: FROM, to: TO }).success,
    ).toBe(true);
    expect(
      SubmissionExportBodySchema.safeParse({ dateMode: 'range', from: FROM, to: FROM }).success,
    ).toBe(true);
  });

  it.each([
    ['without dates', { dateMode: 'range' }],
    ['without to', { dateMode: 'range', from: FROM }],
    ['ending before it starts', { dateMode: 'range', from: TO, to: FROM }],
  ])('refuses a range %s', (_label, body) => {
    expect(SubmissionExportBodySchema.safeParse(body).success).toBe(false);
  });

  it('ignores dates outside range mode', () => {
    expect(
      SubmissionExportBodySchema.safeParse({ dateMode: 'all', from: TO, to: FROM }).success,
    ).toBe(true);
  });

  it.each([
    ['format', { format: 'xlsx' }],
    ['layout', { template: 'fancy' }],
    ['locale', { locale: 'de' }],
    ['version id', { formVersionId: 'v1' }],
  ])('refuses an unknown %s', (_label, body) => {
    expect(SubmissionExportBodySchema.safeParse(body).success).toBe(false);
  });
});

describe('SubmissionExportFieldsBodySchema', () => {
  it('applies the filter defaults only', () => {
    expect(SubmissionExportFieldsBodySchema.parse({})).toEqual({
      dateMode: 'sinceLastExport',
      includeDrafts: false,
      template: 'multiRowEmptySpacesCSVExport',
    });
  });

  it('refuses a range ending before it starts', () => {
    expect(
      SubmissionExportFieldsBodySchema.safeParse({ dateMode: 'range', from: TO, to: FROM }).success,
    ).toBe(false);
  });
});
