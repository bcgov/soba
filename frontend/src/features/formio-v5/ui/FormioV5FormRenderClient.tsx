'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { FormioProvider, Submission } from '@formio/react';
import type { FormType } from '@formio/react';
import { Alert } from 'react-bootstrap';
import { useDictionary } from '@/app/[lang]/Providers';
import { normalizeFormioRenderError } from '@/src/features/formio-v5/normalizeFormioRenderError';
import { useFormioV5FormChrome } from '@/lib/hooks/useFormioV5FormChrome';
import { FormioV5FormRenderErrorBoundary } from '@/src/features/formio-v5/ui/FormioV5FormRenderErrorBoundary';
import {
  getSobaFormVersions,
  getFormVersionSchema,
  createSobaFormSubmission,
  saveSobaFormSubmission,
} from '@/src/shared/api/sobaApi';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useAppSelector } from '@/lib/store';

const Form = dynamic(() => import('@formio/react').then((m) => m.Form), {
  ssr: false,
  loading: () => <p className="text-muted small">Loading form renderer…</p>,
});

type FormRenderLabels = {
  loading: string;
  loadError: string;
  unavailable: string;
  rendererError: string;
  submitSuccess: string;
};

/**
 * Renders the currently published version of a form (keyed on the SOBA formId) in JSON mode and
 * persists submissions through the SOBA API. The Form.io engine is never contacted from the browser.
 */
function FormioV5FormRenderBody({ formId, labels }: { formId: string; labels: FormRenderLabels }) {
  const { token } = useKeycloak();
  const { activeWorkspaceId } = useAppSelector((state) => state.workspace);
  const ws = activeWorkspaceId || undefined;

  const [schema, setSchema] = useState<FormType | null>(null);
  const [formVersionId, setFormVersionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [successAlert, setSuccessAlert] = useState(false);
  const [submitted, setSubmitted] = useState<Submission | null>(null);
  const [loaded, setLoaded] = useState(false);
  // The Form.io webform instance; in JSON mode (no `src`) we must signal it when our own
  // persistence finishes, or its submit button spins forever.
  const formInstanceRef = useRef<{
    emit: (event: string, ...args: unknown[]) => void;
  } | null>(null);

  useFormioV5FormChrome(true);

  useEffect(() => {
    if (!token || loaded) return;
    let active = true;
    void (async () => {
      try {
        // Submissions can only be made to the currently published version.
        const { items } = await getSobaFormVersions(token, formId, ws);
        const published = (items || []).find((v) => v.state === 'published');
        if (!published) {
          if (active) setLoadError(labels.unavailable);
          return;
        }
        const loadedSchema = await getFormVersionSchema(token, published.id, ws);
        if (!loadedSchema) {
          if (active) setLoadError(labels.unavailable);
          return;
        }
        if (active) {
          setFormVersionId(published.id);
          setSchema(loadedSchema);
        }
      } catch (err) {
        if (active) setLoadError(normalizeFormioRenderError(err, labels.loadError));
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [token, formId, ws, loaded, labels.loadError, labels.unavailable]);

  const submitForm = async (submission: Submission) => {
    if (!token || !formVersionId) return;
    try {
      const created = await createSobaFormSubmission(token, formId, formVersionId, {}, ws);
      await saveSobaFormSubmission(
        token,
        created.id,
        (submission?.data ?? {}) as Record<string, unknown>,
        'submit',
        ws,
      );
      setSuccessAlert(true);
      // Tell the webform the submission is complete so its submit button stops spinning,
      // then re-render the form read-only with the submitted answers.
      formInstanceRef.current?.emit('submitDone', submission);
      setSubmitted(submission);
    } catch (err) {
      setRenderError(normalizeFormioRenderError(err, labels.rendererError));
      formInstanceRef.current?.emit('submitError', labels.rendererError);
    }
  };

  if (loadError) {
    return (
      <Alert variant="danger" role="alert">
        {loadError}
      </Alert>
    );
  }

  if (!schema) {
    return <p className="text-muted small">{labels.loading}</p>;
  }

  return (
    <>
      {renderError ? (
        <Alert variant="danger" role="alert">
          {renderError}
        </Alert>
      ) : null}
      {successAlert ? (
        <Alert variant="success" role="alert">
          {labels.submitSuccess}
        </Alert>
      ) : null}
      <div className="formio-v5-chrome" data-soba-formio-chrome>
        <FormioV5FormRenderErrorBoundary
          fallback={
            <Alert variant="danger" role="alert">
              {labels.rendererError}
            </Alert>
          }
        >
          <FormioProvider>
            <Form
              key={submitted ? 'readonly' : 'edit'}
              className="formio-v5-form-root"
              src=""
              form={schema}
              submission={submitted ?? undefined}
              options={submitted ? { readOnly: true } : undefined}
              onFormReady={(instance) => {
                formInstanceRef.current = instance;
              }}
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

  if (!formId) {
    return (
      <Alert variant="danger" role="alert">
        {labels.missingId}
      </Alert>
    );
  }

  return (
    <div className="mt-3">
      <FormioV5FormRenderBody
        key={formId}
        formId={formId}
        labels={{
          loading: dict.form?.loading || 'Loading…',
          loadError: labels.loadError,
          unavailable: labels.unavailable,
          rendererError: labels.rendererError,
          submitSuccess: labels.submitSuccess,
        }}
      />
    </div>
  );
}
