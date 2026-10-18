'use client';

import { useId, useMemo } from 'react';
import { InlineAlert, Radio, RadioGroup } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { DataTable, type Column } from '@/src/components/DataTable';
import { useFormatLongDate } from '@/src/shared/hooks/useFormatLongDate';
import { templateExtensionsText, templateFileAccept } from '@/src/types/templates';
import type { StaffPrintTemplate } from '../data/useSubmissionPrint';

export type TemplateSource = 'upload' | 'default';

type TemplatePrintOptionsProps = Readonly<{
  /** The form version's stored template, when there is one to print with. */
  template: StaffPrintTemplate | null;
  loadError: string | null;
  source: TemplateSource;
  onSourceChange: (source: TemplateSource) => void;
  onFileChange: (file: File | null) => void;
  fileError: string | null;
  isDisabled: boolean;
}>;

/** The template print options: a one-off template upload, or the form version's own template. */
export function TemplatePrintOptions({
  template,
  loadError,
  source,
  onSourceChange,
  onFileChange,
  fileError,
  isDisabled,
}: TemplatePrintOptionsProps) {
  const dict = useDictionary();
  const text = dict.form.templates;
  const formatLongDate = useFormatLongDate();
  const fileInputId = useId();
  const typesId = useId();

  const columns: Column<StaffPrintTemplate>[] = useMemo(
    () => [
      { key: 'filename', label: text.print.fileNameColumn },
      {
        key: 'createdAt',
        label: text.print.uploadDateColumn,
        render: (row) => formatLongDate(row.createdAt),
      },
    ],
    [text.print.fileNameColumn, text.print.uploadDateColumn, formatLongDate],
  );

  return (
    <div data-testid="print-submission-template-tab">
      {loadError ? (
        <div className="mb-3">
          <InlineAlert variant="danger" role="alert" title={loadError} />
        </div>
      ) : null}
      <RadioGroup
        label={text.print.sourceLabel}
        value={source}
        onChange={(value) => onSourceChange(value as TemplateSource)}
        isDisabled={isDisabled}
      >
        <Radio value="upload" data-testid="print-template-source-upload">
          {text.print.uploadOption}
        </Radio>
        {template ? (
          <Radio value="default" data-testid="print-template-source-default">
            {text.print.defaultOption}
          </Radio>
        ) : null}
      </RadioGroup>

      {source === 'upload' ? (
        <div className="mt-3">
          <label htmlFor={fileInputId} className="form-label">
            {text.fileLabel}
          </label>
          <input
            id={fileInputId}
            type="file"
            className="form-control"
            accept={templateFileAccept('cdogs')}
            aria-describedby={typesId}
            data-testid="print-template-file-input"
            disabled={isDisabled}
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          <div id={typesId} className="form-text">
            {text.acceptedTypes.replace('{types}', templateExtensionsText('cdogs'))}
          </div>
          {fileError ? (
            <div className="text-danger small mt-1" role="alert">
              {fileError}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3" data-testid="print-template-default-table">
          <DataTable<StaffPrintTemplate>
            data={template ? [template] : []}
            columns={columns}
            caption={text.print.defaultOption}
            keyExtractor={(row) => row.id}
          />
        </div>
      )}
    </div>
  );
}
