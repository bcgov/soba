import {
  ApiErrorCodes,
  type SubmissionExportBody,
  type SubmissionExportFormat,
  type SubmissionExportFieldsBody,
  type SubmissionExportFieldsResponse,
} from '@soba/lib';
import { getFormById, type FormRecord } from '../../db/repos/formRepo';
import { listSubmissionsForExport, type SubmissionExportRow } from '../../db/repos/submissionRepo';
import { getLastExportToDate, recordSubmissionExport } from '../../db/repos/submissionExportRepo';
import { SubmissionWorkflowState } from '../../db/codes';
import { profileHelpers } from '../../auth/jwtClaims';
import { createFormEngineAdapter } from '../../integrations/form-engine/FormEngineRegistry';
import { NotFoundError, ValidationError } from '../../errors';
import { readEngineSchema } from '../engineSchema';
import { getPublicUser } from '../publicUser';
import { buildHeaders, toCsv, type ExportRecord } from './csv';
import { flattenComponents, type FormComponent } from './schemaFields';

export interface SubmissionExportContext {
  workspaceId: string;
  formId: string;
  actorId: string;
}

export interface SubmissionExportFile {
  filename: string;
  contentType: string;
  body: string;
}

// Submits stamp their time before commit; leave them for the next export.
const SETTLE_MS = 5000;
// CHEFS 1's name for an anonymous submitter.
const PUBLIC_SUBMITTER = 'public';

/** Inclusive date bounds for the filters. */
const resolveDates = (
  body: SubmissionExportFieldsBody,
  last: Date | null,
): { from?: Date; to: Date } => {
  if (body.dateMode === 'range') return { from: new Date(body.from!), to: new Date(body.to!) };
  const to = new Date(Date.now() - SETTLE_MS);
  if (body.dateMode === 'all' || !last) return { to };
  return { from: new Date(last.getTime() + 1), to };
};

/** Answers by engine ref. */
const readAnswers = async (form: FormRecord, rows: SubmissionExportRow[]) => {
  const adapter = createFormEngineAdapter(form.formEngineCode);
  if (typeof adapter.readSubmissions !== 'function') {
    throw new ValidationError(
      `Form engine '${form.formEngineCode}' cannot read submissions in bulk`,
      ApiErrorCodes.form_not_ready,
    );
  }
  const byForm = Map.groupBy(
    rows.filter((row) => row.engineSchemaRef && row.engineSubmissionRef),
    (row) => row.engineSchemaRef!,
  );
  const reads = await Promise.all(
    [...byForm].map(([engineFormRef, formRows]) =>
      adapter.readSubmissions!(
        engineFormRef,
        formRows.map((row) => row.engineSubmissionRef!),
      ),
    ),
  );
  return new Map(reads.flatMap((docs) => [...docs]));
};

/** Answer columns of the exported versions, newest first. */
const readFieldNames = async (form: FormRecord, rows: SubmissionExportRow[]) => {
  const versions = [...new Map(rows.map((row) => [row.versionNo, row.engineSchemaRef]))]
    .sort(([a], [b]) => b - a)
    .map(([, ref]) => ref);
  const schemas = await Promise.all(
    versions.map((ref) => readEngineSchema(form.formEngineCode, ref)),
  );
  const names = schemas.flatMap((schema) =>
    flattenComponents(schema?.components as FormComponent[] | undefined),
  );
  return [...new Set(names)];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Points file `url`s at the staff download page. */
const withStaffFileLinks = (value: unknown, fileLink: (fileId: string) => string): unknown => {
  if (Array.isArray(value)) return value.map((item) => withStaffFileLinks(item, fileLink));
  if (!isRecord(value)) return value;
  if (value.storage === 'chefs' && typeof value.id === 'string') {
    return { ...value, url: fileLink(value.id) };
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, withStaffFileLinks(child, fileLink)]),
  );
};

/** CHEFS 1 metadata plus status, IP and user agent. */
const metadataOf = (form: FormRecord, row: SubmissionExportRow, publicUserId?: string) => {
  const anonymous = row.submittedBy === publicUserId;
  const profile = row.submitterProfile as Parameters<typeof profileHelpers.getEmail>[0];
  return {
    submissionId: row.id,
    // Only once submitted.
    confirmationId:
      row.workflowState === SubmissionWorkflowState.submitted ? row.confirmationCode : null,
    formName: form.name,
    version: row.versionNo,
    createdAt: row.createdAt.toISOString(),
    fullName: anonymous ? PUBLIC_SUBMITTER : profileHelpers.getDisplayName(profile),
    username: anonymous ? PUBLIC_SUBMITTER : profileHelpers.getPreferredUsername(profile),
    email: anonymous ? null : profileHelpers.getEmail(profile),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    status: row.workflowState,
    ipAddress: row.submittedIp,
    userAgent: row.submittedUserAgent,
  };
};

/** CHEFS 1's export file name. */
const exportFilename = (formName: string, format: SubmissionExportFormat) =>
  `${formName
    .replaceAll(/\s+/g, '_')
    .replaceAll(/[^-\w]/g, '')
    .toLowerCase()}_submissions.${format}`;

/** Records, columns, upper bound and last export for the filters. */
const gather = async (ctx: SubmissionExportContext, body: SubmissionExportFieldsBody) => {
  const [form, last] = await Promise.all([
    getFormById(ctx.workspaceId, ctx.formId),
    getLastExportToDate(ctx.formId, ctx.actorId),
  ]);
  if (!form) throw new NotFoundError('Form not found');
  const dates = resolveDates(body, last);
  const rows = await listSubmissionsForExport({
    workspaceId: ctx.workspaceId,
    formId: ctx.formId,
    formVersionId: body.formVersionId,
    includeDrafts: body.includeDrafts,
    ...dates,
  });
  const [answers, fieldNames, publicUser] = await Promise.all([
    readAnswers(form, rows),
    readFieldNames(form, rows),
    getPublicUser(),
  ]);
  const records = rows.map((row): ExportRecord => {
    const doc = answers.get(row.engineSubmissionRef ?? '');
    // As CHEFS 1.
    const data = { ...(isRecord(doc?.data) ? doc.data : {}) };
    delete data.submit;
    return { form: metadataOf(form, row, publicUser?.id), ...data };
  });
  const headers = buildHeaders(records, fieldNames, body.template === 'singleRowCSVExport');
  return { form, records, headers, to: dates.to, last };
};

export const submissionExportService = {
  /** Columns for the filters, and the caller's last export. */
  async fields(
    ctx: SubmissionExportContext,
    body: SubmissionExportFieldsBody,
  ): Promise<SubmissionExportFieldsResponse> {
    const { headers, last } = await gather(ctx, body);
    return { fields: headers, lastExportedAt: last?.toISOString() ?? null };
  },

  /** The export file; the export is recorded. */
  async export(
    ctx: SubmissionExportContext,
    body: SubmissionExportBody,
    linkBase: string,
  ): Promise<SubmissionExportFile> {
    const { form, records, headers, to } = await gather(ctx, body);
    const linked = records.map(
      (record) =>
        withStaffFileLinks(
          record,
          (fileId) =>
            `${linkBase}/build/${ctx.formId}/submissions/${record.form.submissionId}/files/${fileId}`,
        ) as ExportRecord,
    );
    const json = body.format === 'json';
    await recordSubmissionExport({
      workspaceId: ctx.workspaceId,
      formId: ctx.formId,
      exportedBy: ctx.actorId,
      toDate: to,
    });
    return {
      filename: exportFilename(form.name, body.format),
      contentType: json ? 'application/json' : 'text/csv',
      body: json
        ? JSON.stringify(linked)
        : toCsv(
            linked,
            headers.filter((header) => !body.fields || body.fields.includes(header)),
            body.template,
          ),
    };
  },
};
