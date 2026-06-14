'use client';

import React, { useMemo, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';

import { useFormioV5FormChrome } from '@/lib/hooks/useFormioV5FormChrome';

import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import type {
  FormType,
  FormBuilderProps,
  FormioProvider as FormioProviderComponent,
} from '@formio/react';
import './FormDesigner.module.css';
import { Modal as CommonModal } from '@/src/components/Modal';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { TextArea, Button, InlineAlert } from '@bcgov/design-system-react-components';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';

// Import Types
import type { FormBuilder as FormioBuilderInstance } from '@formio/js';

/**
 * We use a type assertion on the dynamic import to ensure
 * the compiler recognizes the props correctly and satisfies strict linting.
 */
const FormBuilder = dynamic(
  async () => {
    const mod = await import('@formio/react');
    return mod.FormBuilder;
  },
  { ssr: false },
) as React.ComponentType<FormBuilderProps>;

const FormioProvider = dynamic(
  async () => {
    const mod = await import('@formio/react');
    return mod.FormioProvider;
  },
  { ssr: false },
) as React.ComponentType<React.ComponentProps<typeof FormioProviderComponent>>;

interface DesignerProps {
  onUpdateModel: (data: FormType) => void;
  initialModel?: FormType | null;
}

const FormDesigner: React.FC<DesignerProps> = ({ onUpdateModel, initialModel = null }) => {
  const { authenticated, initializing } = useKeycloak();
  const dict = useDictionary();
  const { addNotification } = useNotificationStore();
  // Inject the Form.io builder CSS (layered) only while the builder is mounted.
  useFormioV5FormChrome('build');
  const builderRef = useRef<FormioBuilderInstance | null>(null);

  /**
   * Lazy initializer so this runs once and gives the builder's `form` prop a
   * stable reference (satisfies ESLint's `react-hooks/refs` rule). We assume a
   * valid Form.io v5 schema from the engine, so no client-side fix-ups.
   */
  const [stableForm, setStableForm] = useState<FormType>(() => initialModel ?? { components: [] });

  const opt = useMemo(
    () => ({
      language: dict.locale,
      i18n: { [dict.locale]: dict },
      useWorker: false,
      display: 'form' as const,
      builder: {
        basic: {
          title: 'Basic',
          weight: 0,
          default: true,
          components: {
            textfield: true,
            textarea: true,
            email: true,
            password: true,
            number: true,
            checkbox: true,
            selectboxes: true,
            select: true,
            radio: true,
            button: true,
          },
        },
        advanced: {
          title: 'Advanced',
          weight: 10,
          default: false,
          components: {
            email: true,
            url: true,
            phoneNumber: true,
            tags: true,
            address: true,
            dateTime: true,
            content: true,
            htmlelement: true,
            currency: true,
            signature: true,
          },
        },
        data: {
          title: 'Data',
          weight: 20,
          default: false,
          components: {
            datagrid: true,
            editgrid: true,
            container: true,
            tree: true,
          },
        },
        layout: {
          title: 'Layout',
          weight: 30,
          default: false,
          components: {
            htmlelement: true,
            content: true,
            columns: true,
            fieldset: true,
            panel: true,
            table: true,
            tabs: true,
            well: true,
          },
        },
        premium: false,
      },
    }),
    [dict],
  );

  const [sidebarEl, setSidebarEl] = useState<HTMLElement | null>(null);

  const handleBuilderReady = useCallback((builder: FormioBuilderInstance) => {
    builderRef.current = builder;
    if (builder.element) {
      const sidebar = (builder.element as HTMLElement).querySelector(
        '.builder-sidebar',
      ) as HTMLElement;
      if (sidebar) {
        setSidebarEl(sidebar);
      }
    }
  }, []);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportJson, setExportJson] = useState('');

  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');

  const handleExport = useCallback(() => {
    if (builderRef.current) {
      const schema = (builderRef.current as FormioBuilderInstance).form || {};
      const json = JSON.stringify(schema, null, 2);
      setExportJson(json);
      // Best-effort clipboard copy; the JSON is shown in the modal regardless.
      navigator.clipboard.writeText(json).catch(() => {});
      setShowExportModal(true);
    }
  }, []);

  const handleImport = useCallback(() => {
    try {
      // FLAG (engine-dependent): this rewrites legacy CHEFS-1 component types to Form.io types.
      // It is a backend/engine-dependent transformation that should live in the engine adapter or a
      // server-side import path, not in the designer. Move when the import flow is built.
      let cleanedJson = importJson.replace(/"type"\s*:\s*"simple(.*?)advanced"/g, '"type": "$1"');
      cleanedJson = cleanedJson.replace(/"type"\s*:\s*"simple(.*?)"/g, '"type": "$1"');
      const parsed = JSON.parse(cleanedJson);
      setStableForm(parsed);
      if (builderRef.current) {
        (builderRef.current as FormioBuilderInstance).form = parsed;
      }
      if (onUpdateModel) onUpdateModel(parsed);
      setShowImportModal(false);
      setImportJson('');
    } catch {
      addNotification({ text: dict.form.invalidJson || 'Invalid JSON format.', type: 'error' });
    }
  }, [importJson, onUpdateModel, addNotification, dict.form.invalidJson]);

  if (initializing) {
    return <CenteredProgress label={dict.form.loading} />;
  }

  if (!authenticated) {
    return <div className="p-5 text-center">Login Required</div>;
  }

  return (
    <section className="p-4 w-100 min-vh-100 position-relative">
      {sidebarEl &&
        createPortal(
          <div className="p-2 mt-2 border-top bg-light">
            <button
              className="mb-2 d-block btn btn-sm btn-outline-secondary w-100"
              onClick={handleExport}
            >
              {dict.form.exportJson || 'Export JSON'}
            </button>
            <button
              className="d-block btn btn-sm btn-outline-secondary w-100"
              onClick={() => setShowImportModal(true)}
            >
              {dict.form.importJson || 'Import JSON'}
            </button>
          </div>,
          sidebarEl,
        )}

      <FormioProvider>
        <FormBuilder
          initialForm={stableForm}
          options={opt}
          onChange={onUpdateModel}
          onBuilderReady={handleBuilderReady}
        />
      </FormioProvider>

      {/* Export Modal */}
      <CommonModal
        show={showExportModal}
        title={dict.form.exportJson || 'Export Form JSON'}
        onClose={() => setShowExportModal(false)}
        size="lg"
        footer={
          <Button variant="secondary" onPress={() => setShowExportModal(false)}>
            {dict.form.close || 'Close'}
          </Button>
        }
      >
        <div className="d-flex flex-column gap-3">
          <InlineAlert variant="success">
            {dict.form.copiedToClipboard || 'Copied to clipboard!'}
          </InlineAlert>
          <div className="json-textarea">
            <TextArea
              aria-label={dict.form.exportJson || 'Export Form JSON'}
              value={exportJson}
              isReadOnly
            />
          </div>
        </div>
      </CommonModal>

      {/* Import Modal */}
      <CommonModal
        show={showImportModal}
        title={dict.form.importJson || 'Import Form JSON'}
        onClose={() => setShowImportModal(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onPress={() => setShowImportModal(false)}>
              {dict.form.cancel || 'Cancel'}
            </Button>
            <Button variant="primary" onPress={handleImport}>
              {dict.form.importSchema || 'Import Schema'}
            </Button>
          </>
        }
      >
        <div className="json-textarea">
          <TextArea
            label={
              dict.form.pasteSchema ||
              'Paste your Form.io JSON schema here. This will replace the current form design.'
            }
            value={importJson}
            onChange={setImportJson}
          />
        </div>
      </CommonModal>
    </section>
  );
};

export default FormDesigner;
