import {
  buildHeaders,
  toCsv,
  unwindPaths,
  type ExportRecord,
} from '../../../../src/core/services/submissionExport/csv';

const fieldNames = ['name', 'people', 'people.first', 'upload'];

const records: ExportRecord[] = [
  {
    form: { submissionId: 's2', version: 2 },
    name: 'Ana',
    people: [{ first: 'Bo' }, { first: 'Cy' }],
    upload: [{ storage: 'chefs', id: 'f1', name: 'a.pdf' }],
    address: { street: ['x'] },
  },
  { form: { submissionId: 's1', version: 1 }, name: 'Di', people: [], upload: [] },
];

describe('buildHeaders', () => {
  it('gives metadata, schema fields, then data columns from every row in schema order', () => {
    expect(buildHeaders(records, fieldNames, false)).toEqual([
      'form.submissionId',
      'form.version',
      'name',
      'people',
      'people.first',
      'upload',
      'upload.storage',
      'upload.id',
      'upload.name',
    ]);
  });

  it('reads file columns from a later row when the newest has no file', () => {
    const headers = buildHeaders([records[1], records[0]], fieldNames, false);
    expect(headers).toContain('upload.name');
  });

  it('indexes array items for one row per submission', () => {
    expect(buildHeaders(records, fieldNames, true)).toEqual([
      'form.submissionId',
      'form.version',
      'name',
      'people.0.first',
      'people.1.first',
      'upload.0.storage',
      'upload.0.id',
      'upload.0.name',
    ]);
  });

  it('has no columns without submissions', () => {
    expect(buildHeaders([], fieldNames, false)).toEqual([]);
  });
});

describe('unwindPaths', () => {
  it('lists arrays to unwind but keeps addresses whole', () => {
    expect(unwindPaths(records)).toEqual(['people', 'upload']);
  });
});

describe('toCsv layouts', () => {
  const headers = ['form.submissionId', 'name', 'people.first'];
  const one = [records[0]];

  it('multi-row with indentation spaces blanks repeated values', () => {
    expect(toCsv(one, headers, 'multiRowEmptySpacesCSVExport')).toBe(
      '"form.submissionId","name","people.first"\n"s2","Ana","Bo"\n,,"Cy"',
    );
  });

  it('multi-row back-filled repeats parent values', () => {
    expect(toCsv(one, headers, 'multiRowBackFilledCSVExport')).toBe(
      '"form.submissionId","name","people.first"\n"s2","Ana","Bo"\n"s2","Ana","Cy"',
    );
  });

  it('single row puts array items in indexed columns', () => {
    expect(
      toCsv(one, ['form.submissionId', 'people.0.first', 'people.1.first'], 'singleRowCSVExport'),
    ).toBe('"form.submissionId","people.0.first","people.1.first"\n"s2","Bo","Cy"');
  });

  it('unformatted writes top-level keys with nested values as JSON', () => {
    const csv = toCsv([{ form: { submissionId: 's9' }, name: 'Ed' }], [], 'unFormattedCSVExport');
    expect(csv).toBe('"form","name"\n"{""submissionId"":""s9""}","Ed"');
  });

  it('is empty without submissions', () => {
    expect(toCsv([], headers, 'multiRowEmptySpacesCSVExport')).toBe('');
  });
});
