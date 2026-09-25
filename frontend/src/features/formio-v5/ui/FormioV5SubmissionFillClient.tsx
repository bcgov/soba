'use client';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useSubmitFill } from '@/src/features/formio-v5/data/useSubmitFill';
import { useSubmissionWriter } from '@/src/features/formio-v5/data/useSubmissionWriter';
import { SubmissionLoadAlert } from '@/src/features/submissions/ui/SubmissionLoadAlert';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';

type FillLabels = {
  loading: string;
  loadError: string;
  rendererError: string;
  submitSuccess: string;
  submitPending: string;
  sessionExpired: string;
  readOnly: string;
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
  // Token is optional: a submission opened anonymously is fillable without signing in.
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const router = useRouter();
  const locale = getLocaleFromPath(usePathname());

  const fill = useSubmitFill(submissionId);
  const writer = useSubmissionWriter(submissionId);

  // Host file constraints (blocked extensions + max size) for the BCGovFile component; {} when files off.
  const bcgovFileOption = useBcgovFileOption();
  const [renderError, setRenderError] = useState<string | null>(null);
  // The head revision loaded with the bundle; each submit is based on it.
  const baseRevisionIdRef = useRef<string | null>(null);
  // The Form.io webform instance; in JSON mode (no `src`) we must signal it on a failed submit,
  // or its submit button spins forever. On success we navigate away instead.
  const formInstanceRef = useRef<{
    emit: (event: string, ...args: unknown[]) => void;
  } | null>(null);

  const bundle = fill.data;
  // An already-submitted submission isn't fillable; only a fillable one drives the form.
  const fillableBundle = bundle && bundle.workflowState !== 'submitted' ? bundle : null;
  const schema = (fillableBundle?.schema ?? null) as FormType | null;
  // A participant who may no longer write (e.g. removed from the audience) gets a read-only form. The
  // backend enforces writes, so a bundle without the flag stays editable.
  const canWrite = fillableBundle?.canWrite !== false;

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
  const formOptions = useMemo(
    () => ({ noAlerts: true, readOnly: !canWrite, ...bcgovFileOption }),
    [bcgovFileOption, canWrite],
  );

  const submitForm = async (submission: Submission) => {
    try {
      const data = (submission?.data ?? {}) as Record<string, unknown>;
      const outcome = await writer.submit(token ?? undefined, data, baseRevisionIdRef.current);
      // A pending revision means the record changed under the filler (a conflict, or it was already
      // submitted); the work is kept for review but this submit did not go through. Keep them on the
      // form with a notice, resync the base so a retry is not permanently stale, and release the
      // submit button. The typed answers stay in the live form (initialData is not reset).
      if (outcome.status === 'held') {
        addNotification({ text: labels.submitPending, type: 'warning' });
        setRenderError(null);
        const head = await writer.reloadHead(token ?? undefined);
        if (head?.workflowState === 'submitted') {
          router.replace(`/${locale}/submission/${submissionId}`);
          return;
        }
        if (head) baseRevisionIdRef.current = head.headRevisionId;
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
    return <SubmissionLoadAlert error={fill.error} />;
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
      {canWrite ? null : (
        <InlineAlert variant="info" data-testid="submission-fill-readonly">
          {labels.readOnly}
        </InlineAlert>
      )}
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
          readOnly: labels.readOnly,
        }}
      />
    </div>
  );
}
