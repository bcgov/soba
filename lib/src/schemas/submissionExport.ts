import { z } from 'zod';

const SUBMISSION_EXPORT_FORMATS = ['csv', 'json'] as const;
export type SubmissionExportFormat = (typeof SUBMISSION_EXPORT_FORMATS)[number];

/** CHEFS 1 CSV layouts; the first is the default. */
export const SUBMISSION_EXPORT_LAYOUTS = [
  'multiRowEmptySpacesCSVExport',
  'multiRowBackFilledCSVExport',
  'singleRowCSVExport',
  'unFormattedCSVExport',
] as const;
export type SubmissionExportLayout = (typeof SUBMISSION_EXPORT_LAYOUTS)[number];

/** Only `queued` until exports run as jobs. */
const SUBMISSION_EXPORT_STATUSES = ['queued'] as const;
export type SubmissionExportStatus = (typeof SUBMISSION_EXPORT_STATUSES)[number];

const FiltersSchema = z.object({
  // Absent means every version.
  formVersionId: z.uuid().optional(),
  // Submitted in [from, to); either bound may be absent.
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  // CSV only.
  layout: z.enum(SUBMISSION_EXPORT_LAYOUTS).optional(),
});

const rangeIsValid = (body: { from?: string; to?: string }) =>
  !body.from || !body.to || new Date(body.from) < new Date(body.to);

const RANGE_MESSAGE = { message: 'from must be before to' };

export const SubmissionExportFieldsBodySchema = FiltersSchema.refine(rangeIsValid, RANGE_MESSAGE);

export const SubmissionExportFieldsResponseSchema = z.object({
  fields: z.array(z.string()),
});

const StartFieldsSchema = FiltersSchema.extend({
  format: z.enum(SUBMISSION_EXPORT_FORMATS).default('csv'),
  // CSV only; absent means all.
  fields: z.array(z.string()).optional(),
});

export const StartSubmissionExportBodySchema = StartFieldsSchema.refine(
  rangeIsValid,
  RANGE_MESSAGE,
);

export const SubmissionExportSchema = StartFieldsSchema.extend({
  id: z.string(),
  formId: z.string(),
  status: z.enum(SUBMISSION_EXPORT_STATUSES),
  createdAt: z.string(),
});

export const SubmissionExportListSchema = z.object({
  items: z.array(SubmissionExportSchema),
});

export type SubmissionExportFieldsBody = z.infer<typeof SubmissionExportFieldsBodySchema>;
export type SubmissionExportFieldsResponse = z.infer<typeof SubmissionExportFieldsResponseSchema>;
export type StartSubmissionExportBody = z.infer<typeof StartSubmissionExportBodySchema>;
export type SubmissionExport = z.infer<typeof SubmissionExportSchema>;
export type SubmissionExportList = z.infer<typeof SubmissionExportListSchema>;
