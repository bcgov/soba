'use client';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { Submission } from '@formio/react';
import type { FormType } from '@formio/react';
import { InlineAlert } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useDictionary } from '@/app/[lang]/Providers';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import { normalizeFormioRenderError } from '@/src/features/formio-v5/normalizeFormioRenderError';
import { FormioV5FormRenderErrorBoundary } from '@/src/features/formio-v5/ui/FormioV5FormRenderErrorBoundary';
import { DynamicForm } from '@/src/features/formio-v5/ui/DynamicForm';
import { useBcgovFileOption } from '@/src/features/formio-v5/useBcgovFileOption';
import {
  setActiveSubmissionId,
  clearActiveSubmissionId,
} from '@/src/features/formio-v5/activeSubmission';
import { getSubmitFillBundle, submitSobaFormSubmission } from '@/src/shared/api/sobaApi';
import { useSubmitFill } from '@/src/features/formio-v5/data/useSubmitFill';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';

type FillLabels = {
  loading: string;
  loadError: string;
  rendererError: string;
  submitSuccess: string;
  submitPending: string;
  sessionExpired: string;
};

/**
 * Renders an already-opened submission for filling, keyed on its id. The submission record exists
 * before this mounts (opened in the start step), so this component only renders + submits — it never
 * creates. Loads the submission's own version schema and any saved answers, so a refresh resumes.
 */
function SubmissionFillBody({
  submissionId,
  labels,
}: Readonly<{
  submissionId: string;
  labels: FillLabels;
}>) {
  // Token is optional: a public-audience submission is fillable without signing in.
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const router = useRouter();
  const locale = getLocaleFromPath(usePathname());

  const fill = useSubmitFill(submissionId);

  // Host file constraints (blocked extensions + max size) for the BCGovFile component; {} when files off.
  const bcgovFileOption = useBcgovFileOption();
  const [renderError, setRenderError] = useState<string | null>(null);
  // The head revision loaded with the bundle; each submit is based on it.
  const baseRevisionIdRef = useRef<string | null>(null);
  // Reused while the kind of write and the answers are unchanged, so a retried write replays.
  const pendingRevisionRef = useRef<{ revisionId: string; key: string } | null>(null);
  // The Form.io webform instance; in JSON mode (no `src`) we must signal it on a failed submit,
  // or its submit button spins forever. On success we navigate away instead.
  const formInstanceRef = useRef<{
    emit: (event: string, ...args: unknown[]) => void;
  } | null>(null);

  const bundle = fill.data;
  // An already-submitted submission isn't fillable; only a fillable one drives the form.
  const fillableBundle = bundle && bundle.workflowState !== 'submitted' ? bundle : null;
  const schema = (fillableBundle?.schema ?? null) as FormType | null;

  useEffect(() => {
    if (!bundle) return;
    if (bundle.workflowState === 'submitted') {
      router.replace(`/${locale}/submission/${submissionId}`);
      return;
    }
    // Each submit is based on the head revision loaded with the bundle.
    baseRevisionIdRef.current = bundle.headRevisionId;
  }, [bundle, submissionId, locale, router]);

  // Expose the submission being filled to the CHEFS upload provider; clear it when leaving so a stale
  // id can't tag an unrelated upload (e.g. a designer preview).
  useEffect(() => {
    setActiveSubmissionId(submissionId);
    return () => clearActiveSubmissionId();
  }, [submissionId]);

  // Form.io resets the live webform when the submission prop isn't deep-equal to what the user has
  // typed, and a token refresh re-renders this — a fresh literal would discard answers in progress.
  // Held to the loaded bundle, which does not revalidate, so the reference is stable.
  const submissionProp = useMemo(
    () => ({ data: (fillableBundle?.content?.data ?? {}) as Submission['data'] }),
    [fillableBundle],
  );
  // We own all submit messaging (success toast + redirect, inline error), so suppress Form.io's
  // built-in green "Submission Complete" alert.
  const formOptions = useMemo(() => ({ noAlerts: true, ...bcgovFileOption }), [bcgovFileOption]);

  const revisionIdsFor = (write: 'save' | 'submit', data: Record<string, unknown>) => {
    const baseRevisionId = baseRevisionIdRef.current;
    if (!baseRevisionId) return {};
    const key = `${write}:${JSON.stringify(data)}`;
    if (pendingRevisionRef.current?.key !== key) {
      pendingRevisionRef.current = { revisionId: uuidv7(), key };
    }
    return { revisionId: pendingRevisionRef.current.revisionId, baseRevisionId };
  };

  const submitForm = async (submission: Submission) => {
    try {
      const data = (submission?.data ?? {}) as Record<string, unknown>;
      const result = await submitSobaFormSubmission(token ?? undefined, submissionId, {
        data,
        ...revisionIdsFor('submit', data),
      });
      // A pending revision means the record changed under the filler (a conflict, or it was already
      // submitted); the work is kept for review but this submit did not go through. Keep them on the
      // form with a notice, refresh the base so a retry is not permanently stale, and release the
      // submit button. The typed answers stay in the live form (initialData is not reset).
      if (result.revision.status === 'pending') {
        addNotification({ text: labels.submitPending, type: 'warning' });
        setRenderError(null);
        try {
          const bundle = await getSubmitFillBundle(token ?? undefined, submissionId);
          if (bundle.workflowState === 'submitted') {
            router.replace(`/${locale}/submission/${submissionId}`);
            return;
          }
          baseRevisionIdRef.current = bundle.headRevisionId;
        } catch {
          // Leave the base as loaded; the notice already asked the filler to try again.
        }
        // Reusing the same revision id would replay this pending write, so force a fresh one.
        pendingRevisionRef.current = null;
        formInstanceRef.current?.emit('submitDone');
        return;
      }
      addNotification({ text: labels.submitSuccess, type: 'success' });
      // Straight to the read-only confirmation; navigating away unmounts the form, so there's no
      // need to emit `submitDone` and no flash of Form.io's own success screen.
      router.push(`/${locale}/submission/${submissionId}`);
    } catch (err) {
      setRenderError(normalizeFormioRenderError(err, labels.rendererError, labels.sessionExpired));
      formInstanceRef.current?.emit('submitError', labels.rendererError);
    }
  };

  if (fill.error) {
    return (
      <InlineAlert variant="danger" role="alert" data-testid="submission-fill-error">
        {normalizeFormioRenderError(fill.error.cause, labels.loadError, labels.sessionExpired)}
      </InlineAlert>
    );
  }

  if (!schema) {
    return <CenteredProgress label={labels.loading} />;
  }

  return (
    <>
      {renderError ? (
        <InlineAlert variant="danger" role="alert" data-testid="submission-fill-render-error">
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
        <div className="formio-v5-chrome" data-soba-formio-chrome data-testid="submission-fill">
          <DynamicForm
            className="formio-v5-form-root"
            src=""
            form={schema}
            submission={submissionProp}
            options={formOptions}
            onFormReady={(instance) => {
              formInstanceRef.current = instance;
            }}
            onError={(err) => {
              setRenderError(
                normalizeFormioRenderError(err, labels.loadError, labels.sessionExpired),
              );
            }}
            onSubmit={submitForm}
          />
        </div>
      </FormioV5FormRenderErrorBoundary>
    </>
  );
}

export default function FormioV5SubmissionFillClient() {
  const params = useParams();
  const raw = params?.submissionId;
  const submissionId = typeof raw === 'string' ? decodeURIComponent(raw) : '';
  const dict = useDictionary();
  const labels = dict.formioV5.formRender;

  if (!submissionId) {
    return (
      <InlineAlert variant="danger" role="alert">
        {labels.missingId}
      </InlineAlert>
    );
  }

  return (
    <div className="mt-3">
      <SubmissionFillBody
        key={submissionId}
        submissionId={submissionId}
        labels={{
          loading: dict.form?.loading || 'Loading…',
          loadError: labels.loadError,
          rendererError: labels.rendererError,
          submitSuccess: labels.submitSuccess,
          submitPending: labels.submitPending,
          sessionExpired: dict.general.sessionExpired,
        }}
      />
    </div>
  );
}
