'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Heading, TextField } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import type { Dictionary } from '@/src/types/plugins';
import {
  deleteDocumentTemplate,
  downloadDocumentTemplate,
  getDocumentGenerationSettings,
  updateDocumentGenerationSettings,
  uploadDocumentTemplate,
  type DocumentGenerationSettings,
} from '../api';

interface FormDocumentGenerationTabProps {
  dict: Dictionary;
  formId: string;
}

const formatBytes = (size: number | null): string => {
  if (size === null) return '';
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
};

export default function FormDocumentGenerationTab({
  dict,
  formId,
}: FormDocumentGenerationTabProps) {
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<DocumentGenerationSettings | null>(null);
  const [printableName, setPrintableName] = useState('');
  const [defaultTemplateId, setDefaultTemplateId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    getDocumentGenerationSettings(token, formId)
      .then((result) => {
        if (!active) return;
        setSettings(result);
        setPrintableName(result.configuration.printableName ?? '');
        setDefaultTemplateId(result.configuration.defaultTemplateId ?? '');
      })
      .catch((error) => {
        if (active) {
          addNotification({
            text: dict.form.documentGenerationLoadError,
            type: 'error',
            consoleError: error,
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, formId, addNotification, dict.form.documentGenerationLoadError]);

  const handleUpload = async (file: File) => {
    if (!token || !settings) return;
    setSaving(true);
    try {
      const template = await uploadDocumentTemplate(token, formId, file);
      setSettings({ ...settings, templates: [...settings.templates, template] });
      if (!defaultTemplateId) setDefaultTemplateId(template.id);
      addNotification({ text: dict.form.documentTemplateUploadSuccess, type: 'success' });
    } catch (error) {
      addNotification({
        text: dict.form.documentTemplateUploadError,
        type: 'error',
        consoleError: error,
      });
    } finally {
      setSaving(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!token || !settings) return;
    setSaving(true);
    try {
      const configuration = await updateDocumentGenerationSettings(token, formId, {
        printableName: printableName.trim() || null,
        defaultTemplateId: defaultTemplateId || null,
      });
      setSettings({ ...settings, configuration });
      addNotification({ text: dict.form.documentGenerationSaveSuccess, type: 'success' });
    } catch (error) {
      addNotification({
        text: dict.form.documentGenerationSaveError,
        type: 'error',
        consoleError: error,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!token || !settings) return;
    setSaving(true);
    try {
      await deleteDocumentTemplate(token, formId, templateId);
      setSettings({
        ...settings,
        templates: settings.templates.filter((template) => template.id !== templateId),
      });
      if (defaultTemplateId === templateId) setDefaultTemplateId('');
      addNotification({ text: dict.form.documentTemplateDeleteSuccess, type: 'success' });
    } catch (error) {
      addNotification({
        text: dict.form.documentTemplateDeleteError,
        type: 'error',
        consoleError: error,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (template: DocumentGenerationSettings['templates'][number]) => {
    if (!token) return;
    try {
      await downloadDocumentTemplate(token, formId, template);
    } catch (error) {
      addNotification({
        text: dict.form.documentTemplateDownloadError,
        type: 'error',
        consoleError: error,
      });
    }
  };

  if (loading) return <CenteredProgress label={dict.form.loading} />;
  if (!settings) return null;

  return (
    <div className="p-4 border rounded-bottom bg-white border-top-0 d-flex flex-column gap-4">
      <section>
        <Heading level={3}>{dict.form.documentTemplatesHeading}</Heading>
        <input
          ref={fileInput}
          type="file"
          accept=".docx,.pdf,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="form-control mb-3"
          disabled={saving}
          data-testid="document-template-upload"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        {settings.templates.length === 0 ? (
          <p className="text-muted">{dict.form.documentTemplatesEmpty}</p>
        ) : (
          <ul className="list-group">
            {settings.templates.map((template) => (
              <li
                key={template.id}
                className="list-group-item d-flex align-items-center justify-content-between gap-3"
              >
                <span>
                  <button
                    type="button"
                    className="btn btn-link p-0 fw-bold align-baseline"
                    onClick={() => void handleDownload(template)}
                  >
                    {template.filename}
                  </button>
                  {template.size !== null && (
                    <span className="text-muted ms-2">{formatBytes(template.size)}</span>
                  )}
                </span>
                <Button
                  variant="tertiary"
                  isDisabled={saving}
                  onPress={() => void handleDelete(template.id)}
                >
                  {dict.form.documentTemplateDelete}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="d-flex flex-column gap-3" style={{ maxWidth: '640px' }}>
        <Heading level={3}>{dict.form.documentOutputHeading}</Heading>
        <TextField
          label={dict.form.documentPrintableNameLabel}
          value={printableName}
          onChange={setPrintableName}
          isDisabled={saving}
        />
        <label className="form-label" htmlFor="document-default-template">
          {dict.form.documentDefaultTemplateLabel}
        </label>
        <select
          id="document-default-template"
          className="form-select"
          value={defaultTemplateId}
          disabled={saving}
          onChange={(event) => setDefaultTemplateId(event.target.value)}
        >
          <option value="">{dict.form.documentDefaultTemplateNone}</option>
          {settings.templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.filename}
            </option>
          ))}
        </select>
        <Button variant="primary" isDisabled={saving} onPress={() => void handleSave()}>
          {saving ? dict.form.saving : dict.form.save}
        </Button>
      </section>
    </div>
  );
}
