import { z } from 'zod';
import { SORT_LOCALES } from '../sort';

const SUBMISSION_EXPORT_FORMATS = ['csv', 'json'] as const;
export type SubmissionExportFormat = (typeof SUBMISSION_EXPORT_FORMATS)[number];

/** CHEFS 1 CSV layouts; the first is the default. */
export const SUBMISSION_EXPORT_TEMPLATES = [
  'multiRowEmptySpacesCSVExport',
  'multiRowBackFilledCSVExport',
  'singleRowCSVExport',
  'unFormattedCSVExport',
] as const;
export type SubmissionExportTemplate = (typeof SUBMISSION_EXPORT_TEMPLATES)[number];

/** Date choice for an export. */
const SUBMISSION_EXPORT_DATE_MODES = ['sinceLastExport', 'all', 'range'] as const;
export type SubmissionExportDateMode = (typeof SUBMISSION_EXPORT_DATE_MODES)[number];

const FiltersSchema = z.object({
  // Absent means every version.
  formVersionId: z.uuid().optional(),
  dateMode: z.enum(SUBMISSION_EXPORT_DATE_MODES).default('sinceLastExport'),
  // Inclusive range bounds.
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  includeDrafts: z.boolean().default(false),
  // Single row has its own columns.
  template: z.enum(SUBMISSION_EXPORT_TEMPLATES).default('multiRowEmptySpacesCSVExport'),
});

const rangeIsValid = (body: { dateMode: SubmissionExportDateMode; from?: string; to?: string }) =>
  body.dateMode !== 'range' ||
  (!!body.from && !!body.to && new Date(body.from) <= new Date(body.to));

const RANGE_MESSAGE = { message: 'A date range needs from and to, with from not after to' };

export const SubmissionExportFieldsBodySchema = FiltersSchema.refine(rangeIsValid, RANGE_MESSAGE);

export const SubmissionExportBodySchema = FiltersSchema.extend({
  format: z.enum(SUBMISSION_EXPORT_FORMATS).default('csv'),
  // CSV only; absent means all.
  fields: z.array(z.string()).optional(),
  // For attachment links.
  locale: z.enum(SORT_LOCALES).default('en'),
}).refine(rangeIsValid, RANGE_MESSAGE);

export const SubmissionExportFieldsResponseSchema = z.object({
  fields: z.array(z.string()),
  // Null when never exported.
  lastExportedAt: z.string().nullable(),
});

export type SubmissionExportFieldsBody = z.infer<typeof SubmissionExportFieldsBodySchema>;
export type SubmissionExportBody = z.infer<typeof SubmissionExportBodySchema>;
export type SubmissionExportFieldsResponse = z.infer<typeof SubmissionExportFieldsResponseSchema>;
