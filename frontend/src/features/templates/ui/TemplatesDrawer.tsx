'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Accordion, Button, TextField } from '@bcgov/design-system-react-components';

import type { TemplateResponse } from '@/src/types/templates';
import { TEMPLATE_FILE_ACCEPT, TEMPLATE_TYPES } from '@/src/types/templates';
import { DataTable, type Column } from '@/src/components/DataTable';
import { ConfirmModal } from '@/src/components/ConfirmModal';
import { RowActionButton } from '@/src/components/RowActionButton';
import { useFormatLongDate } from '@/src/shared/hooks/useFormatLongDate';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { classifyDataError, messageForDataError } from '@/src/shared/api/dataError';
import { useForm } from '@/src/features/designer/data/useForm';
import type { FormSettingsSectionProps } from '@/src/features/form-settings/types';
import { useTemplates } from '../data/useTemplates';

const KB = 1024;

function formatSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < KB) return `${bytes} B`;
  const kb = bytes / KB;
  return kb < KB ? `${Math.round(kb)} KB` : `${(kb / KB).toFixed(1)} MB`;
}

/** The uploaded file's name without its extension, as the default template name. */
const nameFromFile = (filename: string): string => filename.replace(/\.[^.]+$/, '');

export default function TemplatesDrawer({
  dict,
  drawerName,
  formId,
}: Readonly<FormSettingsSectionProps>) {
  const text = dict.form.templates;
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const formatLongDate = useFormatLongDate();
  // Templates are held per version; the settings tab edits the form's current one.
  const { currentVersion } = useForm(formId);
  const formVersionId = currentVersion?.id ?? null;
  const { templates, loading, error, upload, remove, download } = useTemplates(formVersionId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TemplateResponse | null>(null);

  const report = useCallback(
    (e: unknown, failedText: string) => {
      addNotification({
        text: messageForDataError(classifyDataError(e), {
          sessionExpired: dict.general.sessionExpired,
          forbidden: dict.general.noAccess,
          failed: failedText,
        }),
        type: 'error',
        consoleError: e,
      });
    },
    [addNotification, dict],
  );

  const clearUpload = useCallback(() => {
    setFile(null);
    setName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const pickFile = (chosen: File | null) => {
    setFile(chosen);
    // Only fills a name the user has not written; they stay free to rename it.
    if (chosen && name.trim() === '') setName(nameFromFile(chosen.name));
  };

  const submitUpload = async () => {
    if (!token || !file || name.trim() === '' || busy) return;
    setBusy(true);
    try {
      await upload(token, name.trim(), file);
      clearUpload();
      addNotification({ text: text.uploadSuccess, type: 'success' });
    } catch (e: unknown) {
      report(e, text.uploadError);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !pendingDelete || busy) return;
    setBusy(true);
    try {
      await remove(token, pendingDelete.id);
      addNotification({ text: text.deleteSuccess, type: 'success' });
      setPendingDelete(null);
    } catch (e: unknown) {
      report(e, text.deleteError);
    } finally {
      setBusy(false);
    }
  };

  const startDownload = useCallback(
    (template: TemplateResponse) => {
      if (!token) return;
      void download(token, template).catch((e: unknown) => report(e, text.downloadError));
    },
    [token, download, report, text.downloadError],
  );

  const columns: Column<TemplateResponse>[] = useMemo(
    () => [
      {
        key: 'name',
        label: text.nameColumn,
        render: (template) => (
          <RowActionButton
            main
            data-testid={`template-${template.id}-download`}
            aria-label={`${text.download} ${template.name}`}
            onPress={() => startDownload(template)}
          >
            {template.name}
          </RowActionButton>
        ),
      },
      { key: 'filename', label: text.fileColumn },
      {
        key: 'size',
        label: text.sizeColumn,
        align: 'end',
        render: (template) => <span className="small">{formatSize(template.size)}</span>,
      },
      {
        key: 'updatedAt',
        label: text.updatedColumn,
        render: (template) => <span className="small">{formatLongDate(template.updatedAt)}</span>,
      },
      {
        key: 'actions',
        label: text.actionsColumn,
        align: 'end',
        width: '10%',
        render: (template) => (
          <RowActionButton
            data-testid={`template-${template.id}-delete`}
            aria-label={`${text.delete} ${template.name}`}
            onPress={() => setPendingDelete(template)}
          >
            {text.delete}
          </RowActionButton>
        ),
      },
    ],
    [text, formatLongDate, startDownload],
  );

  return (
    <Accordion id={drawerName} data-testid={`accordion-${drawerName}`} label={text.drawerLabel}>
      <div className="d-block w-100">
        <div className="d-md-flex align-items-end gap-2 mb-3 w-100">
          <TextField
            label={text.nameLabel}
            value={name}
            isDisabled={busy || !formVersionId}
            data-testid="template-name-field"
            onChange={setName}
          />
          <div className="d-flex flex-column">
            <label className="form-label mb-1" htmlFor="template-file-input">
              {text.fileLabel}
            </label>
            <input
              id="template-file-input"
              ref={fileInputRef}
              type="file"
              className="form-control"
              accept={TEMPLATE_FILE_ACCEPT}
              data-testid="template-file-input"
              disabled={busy || !formVersionId}
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            data-testid="template-upload-button"
            isDisabled={busy || !file || name.trim() === '' || !formVersionId}
            onPress={submitUpload}
          >
            {busy ? text.uploading : text.upload}
          </Button>
        </div>
        <p className="text-muted small" data-testid="template-accepted-types">
          {text.acceptedTypes.replace('{types}', TEMPLATE_TYPES)}
        </p>

        <DataTable<TemplateResponse>
          data={templates}
          columns={columns}
          loading={loading}
          error={error ? text.loadError : null}
          emptyMessage={text.empty}
          caption={text.drawerLabel}
          keyExtractor={(template) => template.id}
        />
      </div>

      <ConfirmModal
        show={pendingDelete !== null}
        title={text.deleteTitle}
        message={text.deleteMessage.replace('{name}', pendingDelete?.name ?? '')}
        confirmLabel={text.delete}
        pending={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Accordion>
  );
}
