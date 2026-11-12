import type { SubmissionExportFormat } from '@soba/lib';
import { isVersionOfForm } from '../../core/db/repos/submissionExportRepo';
import { ValidationError } from '../../core/errors';
import {
  engineExportSource,
  exportSchemas,
  formAnswerReader,
} from '../../features/submission-export/engineSource';
import { exportFormat } from '../../features/submission-export/formats';
import { exportFieldNames } from '../../features/submission-export/schemaFields';
import type { ExportBounds } from '../../features/submission-export/source';
import { submissionExportQuery } from '../../features/submission-export/submissionQuery';

export interface IntegrationExportOptions {
  format: SubmissionExportFormat;
  fields?: string[];
  signal: AbortSignal;
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
    if (bounds.formVersionId && !(await isVersionOfForm(bounds.formId, bounds.formVersionId))) {
      throw new ValidationError('That version is not one of this form');
    }

    const schemas = await exportSchemas(bounds.workspaceId, bounds.formId, bounds.formVersionId);
    const source = engineExportSource(
      submissionExportQuery,
      await formAnswerReader(bounds.workspaceId, bounds.formId),
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
      content: format.serialize(rows, {
        fields: options.fields ?? exportFieldNames(schemas),
        schemas,
      }),
    };
  },
};
