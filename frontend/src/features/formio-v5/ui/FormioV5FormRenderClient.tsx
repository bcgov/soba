'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { FormioProvider, Submission } from '@formio/react';
import { InlineAlert } from '@bcgov/design-system-react-components';
import { useDictionary } from '@/app/[lang]/Providers';
import { getFormioProxyBaseUrl } from '@/src/shared/config/runtimeConfig';
import { normalizeFormioRenderError } from '@/src/features/formio-v5/normalizeFormioRenderError';
import { setupFormioClient } from '@/src/features/formio-v5/setupFormioClient';
import { useFormioV5FormChrome } from '@/src/features/formio-v5/useFormioV5FormChrome';
import { FormioV5FormRenderErrorBoundary } from '@/src/features/formio-v5/ui/FormioV5FormRenderErrorBoundary';
import { getSobaFormVersionFromFormioId, createSobaFormSubmission } from '@/src/shared/api/sobaApi';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import type { SobaFormWithVersionResponse } from '@/src/types/forms';

const Form = dynamic(() => import('@formio/react').then((m) => m.Form), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-[var(--typography-color-secondary)]">Loading form renderer…</p>
  ),
});

type FormRenderLabels = {
  loadError: string;
  rendererError: string;
  submitSuccess: string;
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
  const { token } = useKeycloak();
  const params = useParams();
  const formIdRaw = params?.formId;
  const formId = typeof formIdRaw === 'string' ? decodeURIComponent(formIdRaw) : '';
  const [sobaForm, setSobaForm] = useState<SobaFormWithVersionResponse | null>(null);
  const [successAlert, setSuccessAlert] = useState(false);

  useFormioV5FormChrome(true);

  const submitForm = async (submission: Submission, saved?: boolean | undefined) => {
     if (saved) {
      const res = await createSobaFormSubmission(
        token as string,
        sobaForm?.id ?? '',
        sobaForm?.formVersion?.id ?? '',
      );
      if (res && res.id) {
        setSuccessAlert(true);
      }
    }
  };

  useEffect(() => {
    if (sobaForm === null) {
      getSobaFormVersionFromFormioId(token as string, formId).then((res) => {
        setSobaForm(res);
      });
    }
  }, [sobaForm, token, formId]);

  return (
    <>
      {renderError ? (
        <InlineAlert variant="danger" role="alert">
          {renderError}
        </InlineAlert>
      ) : null}
      {successAlert ? (
        <InlineAlert variant="success" role="alert">
          {labels.submitSuccess}
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
              onSubmit={submitForm}
            />
          </FormioProvider>
        </FormioV5FormRenderErrorBoundary>
      </div>
    </>
  );
}

export default function FormioV5FormRenderClient() {
  const params = useParams();
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
    return (
      <InlineAlert variant="danger" role="alert">
        {labels.missingId}
      </InlineAlert>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <FormioV5FormRenderBody
        key={formId}
        src={src}
        base={base}
        labels={{
          loadError: labels.loadError,
          rendererError: labels.rendererError,
          submitSuccess: labels.submitSuccess,
        }}
      />
    </div>
  );
}
