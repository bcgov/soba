import { randomUUID } from 'node:crypto';
import {
  SubmissionExportFieldsResponseSchema,
  SubmissionExportSchema,
  type StartSubmissionExportBody,
  type SubmissionExport,
} from '@soba/lib';
import { NotFoundError } from '../../errors';
import exportsData from './exportsData.json';

// Placeholder methods until exports run as jobs. Data comes from static exportsData.json; new
// exports stay in memory until restart and never leave `queued`.
const sampleFields = SubmissionExportFieldsResponseSchema.parse(exportsData);
const sampleExports = exportsData.exports;
const started = new Map<string, SubmissionExport[]>();

/** Who is asking, about which form. */
export type ExportContext = { actorId: string; formId: string };

const keyOf = (ctx: ExportContext) => `${ctx.formId}:${ctx.actorId}`;

const read = (ctx: ExportContext): SubmissionExport[] =>
  started.get(keyOf(ctx)) ??
  sampleExports.map((sample) => SubmissionExportSchema.parse({ ...sample, formId: ctx.formId }));

export const submissionExportService = {
  fields: () => Promise.resolve(sampleFields),

  list: (ctx: ExportContext) => Promise.resolve({ items: read(ctx) }),

  get: (ctx: ExportContext, exportId: string) => {
    const found = read(ctx).find((item) => item.id === exportId);
    if (!found) return Promise.reject(new NotFoundError('Export not found'));
    return Promise.resolve(found);
  },

  start: (ctx: ExportContext, body: StartSubmissionExportBody) => {
    const created: SubmissionExport = {
      ...body,
      id: randomUUID(),
      formId: ctx.formId,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };
    started.set(keyOf(ctx), [created, ...read(ctx)]);
    return Promise.resolve(created);
  },
};
