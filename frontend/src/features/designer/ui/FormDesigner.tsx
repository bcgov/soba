'use client';

import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';

// Import CSS
import '@formio/js/dist/formio.full.min.css';

import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { FormType } from '@formio/react';

// Import Types
import type { FormBuilder as FormioBuilderInstance } from '@formio/js';

/**
 * We use a type assertion on the dynamic import to ensure
 * the compiler recognizes the props correctly.
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

  useEffect(() => {
    const init = async () => {
      const { Formio } = await import('@formio/js');
      const g = globalThis as unknown as Record<string, unknown>;

      if (!g['Formio']) {
        g['Formio'] = Formio;
      }

      const baseUrl = `${process.env.NEXT_PUBLIC_SOBA_API_BASE_URL}/formio-v5`;
      Formio.setBaseUrl(baseUrl);
      Formio.setProjectUrl(baseUrl);

      setEngineReady(true);
    };
    init();
  }, []);

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

  const initialFormRef = useRef<FormType>(sanitizeForm(initialModel));

  const opt = useMemo(
    () => ({
      language: dict.locale,
      i18n: { [dict.locale]: dict },
      builder: { premium: false },
      noDefaultSubmitButton: true,
      useWorker: false,
      display: 'form' as const,
    }),
    [dict],
  );

  const handleBuilderReady = useCallback((builder: FormioBuilderInstance) => {
    builderRef.current = builder;
    if (builder.instance) {
      builder.instance.setForm(initialFormRef.current);
    }
  }, []);

  if (initializing || !engineReady) {
    return <div className="p-10 text-center">Loading Designer...</div>;
  }

  if (!authenticated) {
    return <div className="p-10 text-center">Login Required</div>;
  }

  return (
    <section className="p-4 w-full min-h-screen">
      <FormioProvider
        baseUrl={`${process.env.NEXT_PUBLIC_SOBA_API_BASE_URL}/formio-v5`}
        projectUrl={`${process.env.NEXT_PUBLIC_SOBA_API_BASE_URL}/formio-v5`}
      >
        <FormBuilder
          key="stable-form-builder"
          form={initialFormRef.current}
          options={opt}
          onChange={onUpdateModel}
          onBuilderReady={handleBuilderReady}
        />
      </FormioProvider>
    </section>
  );
};

export default FormDesigner;
