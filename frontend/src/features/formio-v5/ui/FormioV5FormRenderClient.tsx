'use client';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FormioProvider, Submission } from '@formio/react';
import type { FormType } from '@formio/react';
import { InlineAlert } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useDictionary } from '@/app/[lang]/Providers';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import { normalizeFormioRenderError } from '@/src/features/formio-v5/normalizeFormioRenderError';
import { FormioV5FormRenderErrorBoundary } from '@/src/features/formio-v5/ui/FormioV5FormRenderErrorBoundary';
import { DynamicForm } from '@/src/features/formio-v5/ui/DynamicForm';
import {
  getSobaFormVersions,
  getFormVersionSchema,
  createSobaFormSubmission,
  saveSobaFormSubmission,
} from '@/src/shared/api/sobaApi';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useAppSelector } from '@/lib/store';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';

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
  const { addNotification } = useNotificationStore();
  const router = useRouter();
  const locale = getLocaleFromPath(usePathname());
  const ws = activeWorkspaceId || undefined;

  const [schema, setSchema] = useState<FormType | null>(null);
  const [formVersionId, setFormVersionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // The Form.io webform instance; in JSON mode (no `src`) we must signal it on a failed
  // save, or its submit button spins forever. On success we navigate away instead.
  const formInstanceRef = useRef<{
    emit: (event: string, ...args: unknown[]) => void;
  } | null>(null);

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
      addNotification({ text: labels.submitSuccess, type: 'success' });
      // Go straight to the saved submission's read-only view — the same page the
      // submissions table links to. Navigating away unmounts the form, so there's
      // no need to emit `submitDone` and no flash of Form.io's own success screen.
      router.push(`/${locale}/submission/${created.id}`);
    } catch (err) {
      setRenderError(normalizeFormioRenderError(err, labels.rendererError));
      formInstanceRef.current?.emit('submitError', labels.rendererError);
    }
  };

  if (loadError) {
    return (
      <InlineAlert variant="danger" role="alert">
        {loadError}
      </InlineAlert>
    );
  }

  if (!schema) {
    return <CenteredProgress label={labels.loading} />;
  }

  return (
    <>
      {renderError ? (
        <InlineAlert variant="danger" role="alert">
          {renderError}
        </InlineAlert>
      ) : null}
      <FormioV5FormRenderErrorBoundary
        fallback={
          <InlineAlert variant="danger" role="alert">
            {labels.rendererError}
          </InlineAlert>
        }
      >
        <div className="formio-v5-chrome" data-soba-formio-chrome>
          <FormioProvider>
            <DynamicForm
              className="formio-v5-form-root"
              src=""
              form={schema}
              // We own all submit messaging (success toast + redirect, inline error),
              // so suppress Form.io's built-in green "Submission Complete" alert.
              options={{ noAlerts: true }}
              onFormReady={(instance) => {
                formInstanceRef.current = instance;
              }}
              onError={(err) => {
                setRenderError(normalizeFormioRenderError(err, labels.loadError));
              }}
              onSubmit={submitForm}
            />
          </FormioProvider>
        </div>
      </FormioV5FormRenderErrorBoundary>
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
      <InlineAlert variant="danger" role="alert">
        {labels.missingId}
      </InlineAlert>
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
