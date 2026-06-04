'use client';

import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';

// Import CSS
import '@formio/js/dist/formio.full.min.css';

import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import type { FormType } from '@formio/react';
import { getFormioProxyBaseUrl } from '@/src/shared/config/runtimeConfig';
import { setupFormioClient } from '@/src/features/formio-v5/setupFormioClient';
import './FormDesigner.module.css';
import Form from 'react-bootstrap/Form';
import { Modal as CommonModal } from '@/src/components/Modal';

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
) as React.ComponentType<Record<string, unknown>>;

const FormioProvider = dynamic(
  async () => {
    const mod = await import('@formio/react');
    return mod.FormioProvider;
  },
  { ssr: false },
) as React.ComponentType<Record<string, unknown>>;

interface DesignerProps {
  onUpdateModel: (data: FormType) => void;
  initialModel?: FormType | null;
}

interface FormioComp {
  widget?: Record<string, unknown> | string | null;
  components?: FormioComp[];
  columns?: Array<{ components?: FormioComp[] }>;
  rows?: Array<Array<{ components?: FormioComp[] }>>;
  [key: string]: unknown;
}

const FormDesigner: React.FC<DesignerProps> = ({ onUpdateModel, initialModel = null }) => {
  const { authenticated, initializing } = useKeycloak();
  const dict = useDictionary();
  const [engineReady, setEngineReady] = useState(false);
  const builderRef = useRef<FormioBuilderInstance | null>(null);

  /**
   * RECURSIVE SANITIZER
   * Prevents the internal dialog crash by ensuring the 'widget' property
   * is always a valid object before the builder renders.
   */
  const sanitizeForm = useCallback((input?: FormType | null): FormType => {
    if (!input) return { components: [] };
    try {
      const copy = JSON.parse(JSON.stringify(input)) as FormType;
      const clean = (comps: FormioComp[]) => {
        comps.forEach((c) => {
          if (!c.widget || typeof c.widget !== 'object') {
            c.widget = { type: 'input' };
          }
          if (c.components) clean(c.components);
          if (c.columns) {
            c.columns.forEach((col) => {
              if (col.components) clean(col.components);
            });
          }
        });
      };

      if (copy.components) {
        clean(copy.components as FormioComp[]);
      }
      return copy;
    } catch {
      return { components: [] };
    }
  }, []);

  /**
   * STABLE STATE INITIALIZATION
   * Using a lazy initializer function inside useState ensures this only runs once.
   * This provides a stable reference to pass into the 'form' prop, satisfying
   * ESLint's 'react-hooks/refs' rule while keeping the Dialog fixed.
   */
  const [stableForm, setStableForm] = useState<FormType>(() => sanitizeForm(initialModel));
  const [builderKey, setBuilderKey] = useState(0);

  useEffect(() => {
    const init = () => {
      setupFormioClient();
      setEngineReady(true);
    };
    init();
  }, []);

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
          default: true,
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
          default: true,
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
          default: true,
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
      navigator.clipboard.writeText(json).catch((err) => console.error('Failed to copy', err));
      setShowExportModal(true);
    }
  }, []);

  const handleImport = useCallback(() => {
    try {
      const parsed = JSON.parse(importJson);
      setStableForm(sanitizeForm(parsed));
      setBuilderKey((prev) => prev + 1);
      if (onUpdateModel) onUpdateModel(parsed);
      setShowImportModal(false);
      setImportJson('');
    } catch {
      alert('Invalid JSON format');
    }
  }, [importJson, onUpdateModel, sanitizeForm]);

  if (initializing || !engineReady) {
    return <div className="p-10 text-center">Loading Designer...</div>;
  }

  if (!authenticated) {
    return <div className="p-10 text-center">Login Required</div>;
  }

  return (
    <section className="p-4 w-full min-h-screen position-relative">
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

      <FormioProvider baseUrl={getFormioProxyBaseUrl()}>
        <FormBuilder
          key={`formio-builder-${builderKey}`}
          initialForm={stableForm}
          options={opt}
          onChange={onUpdateModel}
          onBuilderReady={handleBuilderReady}
        />
      </FormioProvider>

      {/* Export Modal */}
      {/* Export Modal */}
      <CommonModal
        show={showExportModal}
        title={dict.form.exportJson || 'Export Form JSON'}
        onClose={() => setShowExportModal(false)}
        size="lg"
        footer={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowExportModal(false)}
          >
            {dict.form.close || 'Close'}
          </button>
        }
      >
        <div className="alert alert-success py-2 mb-2">
          {dict.form.copiedToClipboard || 'Copied to clipboard!'}
        </div>
        <Form.Control
          as="textarea"
          style={{ height: '400px' }}
          className="form-control font-monospace"
          rows={15}
          value={exportJson}
          readOnly
        />
      </CommonModal>

      {/* Import Modal */}
      <CommonModal
        show={showImportModal}
        title={dict.form.importJson || 'Import Form JSON'}
        onClose={() => setShowImportModal(false)}
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowImportModal(false)}
            >
              {dict.form.cancel || 'Cancel'}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleImport}>
              {dict.form.importSchema || 'Import Schema'}
            </button>
          </>
        }
      >
        <p className="text-muted small">
          {dict.form.pasteSchema ||
            'Paste your Form.io JSON schema here. This will replace the current form design.'}
        </p>
        <Form.Control
          as="textarea"
          className="form-control font-monospace"
          style={{ height: '400px' }}
          rows={15}
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          placeholder={dict.form.pasteJsonPlaceholder || 'Paste JSON here...'}
        />
      </CommonModal>
    </section>
  );
};

export default FormDesigner;
