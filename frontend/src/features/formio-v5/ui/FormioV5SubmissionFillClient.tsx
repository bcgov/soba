'use client';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Submission } from '@formio/react';
import type { FormType } from '@formio/react';
import { Button, InlineAlert } from '@bcgov/design-system-react-components';
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
  sessionExpired: string;
  readOnly: string;
  saveDraft: string;
  savingDraft: string;
  draftSaved: string;
  heldSave: string;
  heldSubmit: string;
  reloadLatest: string;
  saveMine: string;
  submitMine: string;
  alreadySubmitted: string;
};

type WriteKind = 'save' | 'submit';
// `resolve`: reloading or writing over after a held write.
type Busy = WriteKind | 'resolve';

type FormInstance = {
  emit: (event: string, ...args: unknown[]) => void;
  submit: () => Promise<unknown>;
  submission?: { data?: Record<string, unknown> };
};

/**
 * Renders an already-opened submission for filling, keyed on its id. The submission record exists
 * before this mounts (opened in the start step), so this component renders, saves drafts and submits;
 * it never creates. Loads the submission's own version schema and any saved answers, so a refresh
 * resumes.
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
  // The head revision each write is based on: the loaded head, then each applied save.
  const baseRevisionIdRef = useRef<string | null>(null);
  // The live Form.io webform: a save reads its answers, "Submit my version" submits it, and a failed
  // submit must emit on it or its button spins forever.
  const formInstanceRef = useRef<FormInstance | null>(null);
  // A submit waits for an in-flight save, so it is based on the revision that save produces.
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const [writing, setWriting] = useState<Busy | null>(null);
  // The write held because the record changed elsewhere. Until the filler reloads or writes over it,
  // saves and submits are refused. The ref gives a submit that waited on a save the current value.
  const [held, setHeld] = useState<WriteKind | null>(null);
  const heldRef = useRef<WriteKind | null>(null);
  const markHeld = (kind: WriteKind | null) => {
    heldRef.current = kind;
    setHeld(kind);
  };

  const bundle = fill.data;
  // An already-submitted submission isn't fillable; only a fillable one drives the form.
  const fillableBundle = bundle && bundle.workflowState !== 'submitted' ? bundle : null;
  const schema = (fillableBundle?.schema ?? null) as FormType | null;
  // A participant who may no longer write (e.g. removed from the audience) gets a read-only form. The
  // backend enforces writes, so a bundle without the flag stays editable.
  const canWrite = fillableBundle?.canWrite !== false;
  const submissionPath = `/${locale}/submission/${submissionId}`;

  useEffect(() => {
    if (bundle?.workflowState === 'submitted') {
      router.replace(submissionPath);
    }
  }, [bundle, submissionPath, router]);

  // Only a newly loaded bundle resets the base; a re-render must not undo a save's revision.
  useEffect(() => {
    if (bundle) baseRevisionIdRef.current = bundle.headRevisionId;
  }, [bundle]);

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

  const onFormReady = useCallback((instance: FormInstance) => {
    formInstanceRef.current = instance;
  }, []);

  // `closed`: submitted elsewhere, so there is nothing left to fill.
  const onHeld = (kind: WriteKind, reason: string) => {
    if (reason === 'closed') {
      addNotification({ text: labels.alreadySubmitted, type: 'warning' });
      router.replace(submissionPath);
      return;
    }
    markHeld(kind);
  };

  const writeError = (err: unknown) =>
    setRenderError(normalizeFormioRenderError(err, labels.rendererError, labels.sessionExpired));

  const runSave = async () => {
    const base = baseRevisionIdRef.current;
    if (!base) return;
    setRenderError(null);
    const data = formInstanceRef.current?.submission?.data ?? {};
    const outcome = await writer.save(token ?? undefined, data, base);
    if (outcome.status === 'applied') {
      baseRevisionIdRef.current = outcome.value.revision.id;
      markHeld(null);
      addNotification({ text: labels.draftSaved, type: 'success' });
    } else if (outcome.status === 'held') {
      onHeld('save', outcome.reason);
    }
  };

  // Saves the answers as they are, without Form.io's validation.
  const saveDraft = async () => {
    setWriting('save');
    const run = runSave().catch(writeError);
    saveInFlightRef.current = run;
    await run;
    saveInFlightRef.current = null;
    setWriting(null);
  };

  const submitForm = async (submission: Submission) => {
    await saveInFlightRef.current;
    if (heldRef.current) {
      formInstanceRef.current?.emit('submitError', '');
      return;
    }
    setWriting('submit');
    try {
      const data = (submission?.data ?? {}) as Record<string, unknown>;
      const outcome = await writer.submit(token ?? undefined, data, baseRevisionIdRef.current);
      if (outcome.status === 'held') {
        setRenderError(null);
        onHeld('submit', outcome.reason);
        // Releases the submit button without Form.io's success state.
        formInstanceRef.current?.emit('submitError', '');
        return;
      }
      addNotification({ text: labels.submitSuccess, type: 'success' });
      // Straight to the read-only confirmation; navigating away unmounts the form, so there's no
      // need to emit `submitDone` and no flash of Form.io's own success screen.
      router.push(submissionPath);
    } catch (err) {
      writeError(err);
      formInstanceRef.current?.emit('submitError', labels.rendererError);
    } finally {
      setWriting(null);
    }
  };

  // Discards the typed answers: a fresh bundle is a new submission prop, which resets the form.
  const reloadLatest = async () => {
    setWriting('resolve');
    try {
      markHeld(null);
      await fill.refresh();
    } finally {
      setWriting(null);
    }
  };

  // Writes the typed answers over the current head. A submit goes through Form.io again, so an
  // invalid form shows its field errors and never reaches submitForm.
  const writeMine = async () => {
    const kind = held;
    if (!kind) return;
    setWriting('resolve');
    const head = await writer.reloadHead(token ?? undefined);
    if (head?.workflowState === 'submitted') {
      onHeld(kind, 'closed');
      return;
    }
    setWriting(null);
    if (!head) {
      setRenderError(labels.loadError);
      return;
    }
    baseRevisionIdRef.current = head.headRevisionId;
    markHeld(null);
    if (kind === 'save') {
      await saveDraft();
    } else {
      await formInstanceRef.current?.submit().catch(() => undefined);
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
      {held ? (
        <div className="mb-3">
          <InlineAlert
            variant="warning"
            // BCDS names the alert from `title`; without it the notice has no accessible name.
            title={held === 'save' ? labels.heldSave : labels.heldSubmit}
            role="status"
            data-testid="submission-fill-held"
            buttons={
              <>
                <Button
                  size="small"
                  variant="secondary"
                  onPress={() => {
                    reloadLatest().catch(writeError);
                  }}
                  isDisabled={writing !== null}
                  data-testid="submission-fill-reload-latest"
                >
                  {labels.reloadLatest}
                </Button>
                <Button
                  size="small"
                  variant="primary"
                  onPress={() => {
                    writeMine().catch(writeError);
                  }}
                  isDisabled={writing !== null}
                  data-testid="submission-fill-write-mine"
                >
                  {held === 'save' ? labels.saveMine : labels.submitMine}
                </Button>
              </>
            }
          />
        </div>
      ) : null}
      {fillableBundle?.canSaveDraft ? (
        <div className="mb-3 d-flex gap-2" data-testid="submission-fill-actions">
          <Button
            variant="secondary"
            onPress={() => {
              saveDraft().catch(writeError);
            }}
            isDisabled={writing !== null || held !== null}
            data-testid="submission-fill-save-draft"
          >
            {writing === 'save' ? labels.savingDraft : labels.saveDraft}
          </Button>
        </div>
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
            onFormReady={onFormReady}
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
          sessionExpired: dict.general.sessionExpired,
          readOnly: labels.readOnly,
          saveDraft: labels.saveDraft,
          savingDraft: labels.savingDraft,
          draftSaved: labels.draftSaved,
          heldSave: labels.heldSave,
          heldSubmit: labels.heldSubmit,
          reloadLatest: labels.reloadLatest,
          saveMine: labels.saveMine,
          submitMine: labels.submitMine,
          alreadySubmitted: labels.alreadySubmitted,
        }}
      />
    </div>
  );
}
