'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { FormioProvider } from '@formio/react';
import { InlineAlert, Text } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { getFormioProxyBaseUrl } from '@/src/shared/config/runtimeConfig';
import { normalizeFormioRenderError } from '@/src/features/formio-v5/normalizeFormioRenderError';
import { setupFormioClient } from '@/src/features/formio-v5/setupFormioClient';
import { useFormioV5FormChrome } from '@/src/features/formio-v5/useFormioV5FormChrome';
import { FormioV5FormRenderErrorBoundary } from '@/src/features/formio-v5/ui/FormioV5FormRenderErrorBoundary';

const Form = dynamic(() => import('@formio/react').then((m) => m.Form), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-[var(--typography-color-secondary)]">Loading form renderer…</p>
  ),
});

type FormRenderLabels = {
  loadError: string;
  rendererError: string;
};

function FormioV5FormRenderBody({
  src,
  base,
  labels,
}: {
  src: string;
  base: string;
  labels: FormRenderLabels;
}) {
  const [renderError, setRenderError] = useState<string | null>(null);
  useFormioV5FormChrome(true);

  return (
    <>
      {renderError ? (
        <InlineAlert variant="danger" role="alert">
          {renderError}
        </InlineAlert>
      ) : null}
      <div className="formio-v5-chrome" data-soba-formio-chrome>
        <FormioV5FormRenderErrorBoundary
          fallback={
            <InlineAlert variant="danger" role="alert">
              {labels.rendererError}
            </InlineAlert>
          }
        >
          <FormioProvider baseUrl={base} projectUrl={base}>
            <Form
              className="formio-v5-form-root"
              src={src}
              onError={(err) => {
                setRenderError(normalizeFormioRenderError(err, labels.loadError));
              }}
            />
          </FormioProvider>
        </FormioV5FormRenderErrorBoundary>
      </div>
    </>
  );
}

export default function FormioV5FormRenderClient() {
  const params = useParams();
  const locale = typeof params?.lang === 'string' ? params.lang : 'en';
  const formIdRaw = params?.formId;
  const formId = typeof formIdRaw === 'string' ? decodeURIComponent(formIdRaw) : '';
  const dict = useDictionary();
  const labels = dict.formioV5.formRender;

  const base = useMemo(() => getFormioProxyBaseUrl().replace(/\/$/, ''), []);
  const src = formId ? `${base}/form/${encodeURIComponent(formId)}` : '';

  useEffect(() => {
    setupFormioClient();
  }, []);

  if (!formId) {
    return <InlineAlert variant="danger" role="alert">{labels.missingId}</InlineAlert>;
  }

  return (
    <div className="mt-4 space-y-4">
      <Text className="text-sm">
        <Link
          className="text-[var(--theme-primary-blue)] underline hover:no-underline"
          href={`/${locale}/submit`}
        >
          {labels.backToList}
        </Link>
      </Text>
      <FormioV5FormRenderBody
        key={formId}
        src={src}
        base={base}
        labels={{
          loadError: labels.loadError,
          rendererError: labels.rendererError,
        }}
      />
    </div>
  );
}
