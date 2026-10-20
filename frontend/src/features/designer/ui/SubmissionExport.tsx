'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Checkbox,
  CheckboxGroup,
  DatePicker,
  Form,
  InlineAlert,
  Link,
  Radio,
  RadioGroup,
  Select,
  TextField,
} from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useDictionary } from '@/app/[lang]/Providers';
import { usePageHeading } from '@/src/components/PageHeader';
import { SecondaryText } from '@/src/components/SecondaryText';
import { LoadErrorAlert } from '@/src/shared/ui/LoadErrorAlert';
import { useAuthErrorDefaults } from '@/src/shared/api/useDataErrorNotice';
import { classifyDataError, messageForDataError } from '@/src/shared/api/dataError';
import { useCallToken } from '@/src/shared/api/callToken';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { useFormatLongDateTime } from '@/src/shared/hooks/useFormatLongDate';
import { useSortLocale } from '@/src/shared/list/useSortLocale';
import { fillTemplate } from '@/src/shared/util/stringUtils';
import { saveBlob } from '@/src/features/templates/data/saveBlob';
import {
  useExportFields,
  useExportForm,
  useSubmissionExporter,
} from '@/src/features/designer/data/useSubmissionExport';
import {
  SUBMISSION_EXPORT_TEMPLATES,
  type SubmissionExportDateMode,
  type SubmissionExportFieldsBody,
  type SubmissionExportFormat,
  type SubmissionExportTemplate,
} from '@/src/types/submissionExport';

const ALL_VERSIONS = 'all';

/** Today as local YYYY-MM-DD. */
const localToday = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** Local day bounds, as CHEFS 1 sends them. */
const dayStart = (day: string) => new Date(`${day}T00:00:00`).toISOString();
const dayEnd = (day: string) => new Date(`${day}T23:59:59.999`).toISOString();

/** The CHEFS 1 export screen, plus versions, since-last-export and drafts. */
export function SubmissionExport({ formId }: Readonly<{ formId: string }>) {
  const dict = useDictionary();
  const text = dict.submission.export;
  const authDefaults = useAuthErrorDefaults();
  const router = useRouter();
  const locale = useSortLocale();
  const formatDateTime = useFormatLongDateTime();
  const { signedInToken } = useCallToken();
  const { addNotification } = useNotificationStore();

  const form = useExportForm(formId);
  const exporter = useSubmissionExporter(formId);
  usePageHeading({ heading: text.pageTitle, eyebrow: form.data?.name });

  const [format, setFormat] = useState<SubmissionExportFormat>('csv');
  const [versionId, setVersionId] = useState(ALL_VERSIONS);
  const [dateMode, setDateMode] = useState<SubmissionExportDateMode>('sinceLastExport');
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [template, setTemplate] = useState<SubmissionExportTemplate>(
    SUBMISSION_EXPORT_TEMPLATES[0],
  );
  const [search, setSearch] = useState('');
  // Unticked fields; new fields start ticked.
  const [unticked, setUnticked] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const rangeChosen = !!from && !!to;
  const rangeValid = rangeChosen && from <= to && to <= localToday();
  const filters: SubmissionExportFieldsBody | null = useMemo(() => {
    if (dateMode === 'range' && !rangeValid) return null;
    return {
      formVersionId: versionId === ALL_VERSIONS ? undefined : versionId,
      dateMode,
      from: dateMode === 'range' ? dayStart(from!) : undefined,
      to: dateMode === 'range' ? dayEnd(to!) : undefined,
      includeDrafts,
      template,
    };
  }, [versionId, dateMode, rangeValid, from, to, includeDrafts, template]);
  const fields = useExportFields(formId, filters);

  const allFields = fields.data?.fields ?? [];
  const selected = allFields.filter((field) => !unticked.includes(field));
  const needle = search.trim().toLowerCase();
  const shown = allFields.filter((field) => field.toLowerCase().includes(needle));
  const isCsv = format === 'csv';
  // The unformatted layout writes every field.
  const picksFields = isCsv && template !== 'unFormattedCSVExport';

  const backToSubmissions = () => router.push(`/${locale}/build/${formId}?tab=submissions`);

  const tickShown = (values: string[]) =>
    setUnticked((prev) => [
      ...prev.filter((field) => !shown.includes(field)),
      ...shown.filter((field) => !values.includes(field)),
    ]);

  const tickAllShown = () => setUnticked((prev) => prev.filter((field) => !shown.includes(field)));
  const untickAllShown = () => setUnticked((prev) => [...new Set([...prev, ...shown])]);

  const runExport = async () => {
    if (!filters) return;
    setExporting(true);
    try {
      const outcome = await exporter.exportFile(signedInToken(), {
        ...filters,
        format,
        fields: picksFields ? selected : undefined,
        locale,
      });
      if (outcome.status === 'applied') {
        const { blob, filename } = outcome.value;
        // BOM so Excel reads UTF-8, as in CHEFS 1.
        saveBlob(isCsv ? new Blob(['\uFEFF', blob], { type: blob.type }) : blob, filename);
        addNotification({ text: text.success, type: 'success' });
      }
    } catch (cause: unknown) {
      addNotification({
        text: messageForDataError(classifyDataError(cause), {
          ...authDefaults,
          failed: text.failed,
        }),
        type: 'error',
        consoleError: cause,
      });
    } finally {
      setExporting(false);
    }
  };

  const canExport =
    !!filters && !exporting && allFields.length > 0 && (!picksFields || selected.length > 0);

  const lastExportNote = () => {
    if (!fields.data) return null;
    const { lastExportedAt } = fields.data;
    return (
      <SecondaryText elementType="p" data-testid="export-last-exported">
        {lastExportedAt
          ? fillTemplate(text.lastExportedAt, { date: formatDateTime(lastExportedAt) })
          : text.neverExported}
      </SecondaryText>
    );
  };

  const renderFields = () => {
    if (fields.error) {
      return (
        <LoadErrorAlert
          error={fields.error}
          messages={{ ...authDefaults, failed: text.fieldsError }}
          testIds={{ failed: 'export-fields-loaderror' }}
        />
      );
    }
    if (!filters) return null;
    if (!fields.data) return <CenteredProgress label={dict.general.loading} />;
    if (allFields.length === 0) {
      return (
        <InlineAlert variant="info" data-testid="export-no-submissions">
          {text.noSubmissions}
        </InlineAlert>
      );
    }
    if (!picksFields) return null;
    return (
      <div className="d-flex flex-column gap-2" data-testid="export-fields">
        <TextField
          label={text.fieldSearch}
          value={search}
          onChange={setSearch}
          data-testid="export-field-search"
        />
        <div className="d-flex gap-2 align-items-center">
          <Button
            variant="tertiary"
            size="small"
            onPress={tickAllShown}
            data-testid="export-fields-all"
          >
            {text.selectAll}
          </Button>
          <Button
            variant="tertiary"
            size="small"
            onPress={untickAllShown}
            data-testid="export-fields-none"
          >
            {text.selectNone}
          </Button>
          <SecondaryText data-testid="export-fields-count">
            {fillTemplate(text.fieldsSelected, {
              selected: String(selected.length),
              total: String(allFields.length),
            })}
          </SecondaryText>
        </div>
        <CheckboxGroup
          label={text.fields}
          value={selected.filter((field) => shown.includes(field))}
          onChange={tickShown}
          isDisabled={exporting}
          data-testid="export-field-list"
        >
          {shown.map((field) => (
            <Checkbox key={field} value={field} data-testid={`export-field-${field}`}>
              {field}
            </Checkbox>
          ))}
        </CheckboxGroup>
      </div>
    );
  };

  const renderForm = () => {
    if (form.error) {
      return (
        <LoadErrorAlert
          error={form.error}
          messages={{ ...authDefaults, failed: text.loadError }}
          testIds={{ failed: 'export-form-loaderror' }}
        />
      );
    }
    if (!form.data) return <CenteredProgress label={dict.general.loading} />;
    const versionItems = [
      { id: ALL_VERSIONS, label: text.allVersions },
      ...[...form.data.versions]
        .sort((a, b) => b.versionNo - a.versionNo)
        .map((version) => ({
          id: version.id,
          label: fillTemplate(text.versionOption, { version: String(version.versionNo) }),
        })),
    ];
    return (
      <Form
        className="d-flex flex-column gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void runExport();
        }}
        data-testid="export-form"
      >
        <RadioGroup
          label={text.fileType}
          value={format}
          onChange={(value) => setFormat(value as SubmissionExportFormat)}
          isDisabled={exporting}
          data-testid="export-format"
        >
          <Radio value="csv" data-testid="export-format-csv">
            {text.csv}
          </Radio>
          <Radio value="json" data-testid="export-format-json">
            {text.json}
          </Radio>
        </RadioGroup>
        <div data-testid="export-version">
          <Select
            size="medium"
            id="export-version-select"
            label={text.version}
            selectedKey={versionId}
            onSelectionChange={(key) => setVersionId(String(key))}
            items={versionItems}
            isDisabled={exporting}
          />
        </div>
        <RadioGroup
          label={text.dates}
          value={dateMode}
          onChange={(value) => setDateMode(value as SubmissionExportDateMode)}
          isDisabled={exporting}
          data-testid="export-dates"
        >
          <Radio value="sinceLastExport" data-testid="export-dates-since">
            {text.sinceLastExport}
          </Radio>
          <Radio value="all" data-testid="export-dates-all">
            {text.all}
          </Radio>
          <Radio value="range" data-testid="export-dates-range">
            {text.range}
          </Radio>
        </RadioGroup>
        {dateMode === 'sinceLastExport' ? lastExportNote() : null}
        {dateMode === 'range' ? (
          <div className="d-flex gap-3 flex-wrap" data-testid="export-range">
            <DatePicker
              label={text.from}
              isRequired
              onChange={(value) => setFrom(value?.toString() ?? null)}
              isInvalid={rangeChosen && !rangeValid}
              errorMessage={text.rangeInvalid}
              isDisabled={exporting}
              data-testid="export-from"
            />
            <DatePicker
              label={text.to}
              isRequired
              onChange={(value) => setTo(value?.toString() ?? null)}
              isInvalid={rangeChosen && !rangeValid}
              errorMessage={text.rangeInvalid}
              isDisabled={exporting}
              data-testid="export-to"
            />
          </div>
        ) : null}
        <Checkbox
          isSelected={includeDrafts}
          onChange={setIncludeDrafts}
          isDisabled={exporting}
          data-testid="export-include-drafts"
        >
          {text.includeDrafts}
        </Checkbox>
        {isCsv ? (
          <RadioGroup
            label={text.layout}
            value={template}
            onChange={(value) => setTemplate(value as SubmissionExportTemplate)}
            isDisabled={exporting}
            data-testid="export-layout"
          >
            {SUBMISSION_EXPORT_TEMPLATES.map((layout) => (
              <Radio key={layout} value={layout} data-testid={`export-layout-${layout}`}>
                {text.layouts[layout]}
              </Radio>
            ))}
          </RadioGroup>
        ) : null}
        {renderFields()}
        <div>
          <Button
            type="submit"
            variant="primary"
            isDisabled={!canExport}
            data-testid="export-submit"
          >
            {exporting ? text.exporting : text.export}
          </Button>
        </div>
      </Form>
    );
  };

  return (
    <div className="mt-3" data-testid="submission-export">
      <div className="mb-3">
        <Link onPress={backToSubmissions} data-testid="export-back">
          {text.back}
        </Link>
      </div>
      {renderForm()}
    </div>
  );
}
