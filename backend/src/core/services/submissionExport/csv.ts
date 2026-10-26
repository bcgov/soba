/** CSV headers and layouts, ported from CHEFS 1. */
import { Parser } from '@json2csv/plainjs';
import { flatten, unwind } from '@json2csv/transforms';
import type { SubmissionExportTemplate } from '@soba/lib';
import { mapOrder } from './schemaFields';

/** Metadata under `form`, then answers. */
export type ExportRecord = { form: Record<string, unknown> } & Record<string, unknown>;

const isNested = (value: unknown): value is Record<string, unknown> | unknown[] =>
  value !== null && typeof value === 'object';

/** Leaf paths, arrays indexed (`grid.0.text`) or not (`grid.text`). */
const leafPaths = (value: unknown, path: string, found: Set<string>, indexed: boolean): void => {
  if (Array.isArray(value) && !indexed) {
    for (const item of value) leafPaths(item, path, found, indexed);
    return;
  }
  if (!isNested(value)) {
    found.add(path);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    leafPaths(child, path ? `${path}.${key}` : key, found, indexed);
  }
};

/** Arrays to unwind into rows; addresses stay whole. */
export const unwindPaths = (records: ExportRecord[]): string[] => {
  const found = new Set<string>();
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      found.add(path);
      for (const item of value) visit(item, path);
      return;
    }
    if (!isNested(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (!key.includes('address')) visit(child, path ? `${path}.${key}` : key);
    }
  };
  for (const record of records) visit(record, '');
  return [...found];
};

/** CSV columns; unlike CHEFS 1, data columns come from every row, not just the first. */
export const buildHeaders = (
  records: ExportRecord[],
  fieldNames: string[],
  singleRow: boolean,
): string[] => {
  if (records.length === 0) return [];
  const metaHeaders = Object.keys(records[0].form).map((key) => `form.${key}`);
  const found = new Set<string>();
  for (const record of records) leafPaths(record, '', found, singleRow);
  const base = singleRow ? metaHeaders : [...metaHeaders, ...fieldNames];
  return [...new Set([...base, ...mapOrder([...found], fieldNames)])];
};

/** CSV in a CHEFS 1 layout; the browser adds the BOM. */
export const toCsv = (
  records: ExportRecord[],
  headers: string[],
  template: SubmissionExportTemplate,
): string => {
  if (records.length === 0) return '';
  if (template === 'unFormattedCSVExport') return new Parser().parse(records);
  if (template === 'singleRowCSVExport') {
    return new Parser({
      fields: headers,
      transforms: [flatten({ objects: true, arrays: true, separator: '.' })],
    }).parse(records);
  }
  // Objects only: CHEFS 1's array option was ignored by json2csv.
  return new Parser({
    fields: headers,
    transforms: [
      unwind({
        paths: unwindPaths(records),
        blankOut: template === 'multiRowEmptySpacesCSVExport',
      }),
      flatten({ objects: true, arrays: false, separator: '.' }),
    ],
  }).parse(records);
};
