import { abortable } from '../middleware/abortable';
import type { SubmissionExportFormat } from '@soba/lib';
import { isVersionOfForm } from '../../core/db/repos/submissionExportRepo';
import { ServiceUnavailableError, ValidationError } from '../../core/errors';
import {
  engineExportSource,
  exportSchemas,
  formAnswerReader,
} from '../../features/submission-export/engineSource';
import { exportFormat } from '../../features/submission-export/formats';
import { exportFieldNames } from '../../features/submission-export/schemaFields';
import type { ExportBounds, ExportRow } from '../../features/submission-export/source';
import { submissionExportQuery } from '../../features/submission-export/submissionQuery';

/** CSV requires each exported row's own schema; another version's fields are not a safe fallback. */
async function* requireCsvSchemas(
  rows: AsyncIterable<ExportRow>,
  schemaVersions: Set<string>,
): AsyncIterable<ExportRow> {
  for await (const row of rows) {
    if (!schemaVersions.has(row.versionId)) {
      throw new ServiceUnavailableError(
        'Some submission schemas are unavailable; export not returned',
      );
    }
    yield row;
  }
}

export interface IntegrationExportOptions {
  format: SubmissionExportFormat;
  /** Recheck active credentials and creator access before each database page. */
  authorize?: () => Promise<void>;
  fields?: string[];
  signal: AbortSignal;
  maxBytes: number;
  /** Missing engine documents are skipped, as in the designer export. */
  onUnread: (count: number) => void;
}

/**
 * Stream an already-authorized form's submissions using the designer's export machinery.
 * The caller must resolve credential scope and require submission_read before calling this.
 * No job or result file is created; the HTTP adapter must enforce response limits and aborts.
 */
export const integrationExportService = {
  async open(bounds: ExportBounds, options: IntegrationExportOptions) {
    options.signal.throwIfAborted();
    if (
      bounds.formVersionId &&
      !(await abortable(options.signal, () =>
        isVersionOfForm(bounds.formId, bounds.formVersionId!),
      ))
    ) {
      throw new ValidationError('That version is not one of this form');
    }

    const schemas = await abortable(options.signal, () =>
      exportSchemas(bounds.workspaceId, bounds.formId, bounds.formVersionId),
    );
    const source = engineExportSource(
      {
        ...submissionExportQuery,
        async *pages(bounds, paging) {
          const pages = submissionExportQuery.pages(bounds, paging)[Symbol.asyncIterator]();
          try {
            while (true) {
              // Each page must be authorized before its query starts.
              // eslint-disable-next-line no-await-in-loop
              await abortable(options.signal, async () => options.authorize?.());
              // eslint-disable-next-line no-await-in-loop
              const page = await abortable(options.signal, () => pages.next());
              if (page.done) return;
              yield page.value;
            }
          } finally {
            await pages.return?.();
          }
        },
      },
      await abortable(options.signal, () => formAnswerReader(bounds.workspaceId, bounds.formId)),
    );
    const format = exportFormat(options.format);
    const rows = source.rows(bounds, {
      pageSize: 100,
      signal: options.signal,
      onUnread: options.onUnread,
    });

    return {
      contentType: format.contentType,
      extension: format.extension,
      content: format.serialize(
        options.format === 'csv'
          ? requireCsvSchemas(rows, new Set(schemas.map((schema) => schema.versionId)))
          : rows,
        {
          fields: options.fields ?? exportFieldNames(schemas),
          schemas,
          signal: options.signal,
          maxBytes: options.maxBytes,
        },
      ),
    };
  },
};
