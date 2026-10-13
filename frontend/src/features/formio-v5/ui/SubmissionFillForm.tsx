'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { FormType, Submission } from '@formio/react';
import { Button, InlineAlert } from '@bcgov/design-system-react-components';
import type { ApiErrorCode } from '@soba/lib';
import { normalizeFormioRenderError } from '@/src/features/formio-v5/normalizeFormioRenderError';
import { FormioV5FormRenderErrorBoundary } from '@/src/features/formio-v5/ui/FormioV5FormRenderErrorBoundary';
import { DynamicForm } from '@/src/features/formio-v5/ui/DynamicForm';
import { useSubmissionWriter } from '@/src/features/formio-v5/data/useSubmissionWriter';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { apiErrorMessage } from '@/src/shared/api/dataError';
import type { SubmitFillBundle } from '@/src/types/forms';

export type FillLabels = {
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
  requestFailed: string;
  errors: Record<ApiErrorCode, string>;
};

/** One loaded bundle and what the caller may do with it. */
export type FillView = {
  snapshot: SubmitFillBundle;
  canWrite: boolean;
  canSaveDraft: boolean;
  /** Form.io options for the BCGovFile component. */
  fileOption: Record<string, unknown>;
};

type WriteKind = 'save' | 'submit';
// `resolve`: reloading or writing over after a held write.
type Busy = WriteKind | 'resolve';

type FormInstance = {
  emit: (event: string, ...args: unknown[]) => void;
  submit: () => Promise<unknown>;
  setSubmission: (submission: { data: Record<string, unknown> }) => Promise<unknown>;
  submission: { data?: Record<string, unknown> };
};

/**
 * Fills one loaded bundle of a submission: saves drafts and submits; it never creates. It reads its
 * view once, when it mounts, so a re-render with a new bundle object never reaches Form.io; showing
 * a newly loaded bundle mounts a new form.
 */
export function SubmissionFillForm({
  submissionId,
  submissionPath,
  view,
  labels,
  onReload,
}: Readonly<{
  submissionId: string;
  /** The submission's read-only view, for a submitted record. */
  submissionPath: string;
  view: FillView;
  labels: FillLabels;
  /** Loads the latest bundle and mounts a new form on it. */
  onReload: () => Promise<void>;
}>) {
  const [{ snapshot, canWrite, canSaveDraft, fileOption }] = useState(view);
  // Token is optional: a submission opened anonymously is fillable without signing in.
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const router = useRouter();
  const writer = useSubmissionWriter(submissionId);

  const [renderError, setRenderError] = useState<string | null>(null);
  // The head revision each write is based on: the loaded head, then each applied save.
  const baseRevisionIdRef = useRef<string | null>(snapshot.headRevisionId);
  // The live Form.io webform: a save reads its answers, "Submit my version" submits it, and a failed
  // submit must emit on it or its button spins forever.
  const formInstanceRef = useRef<FormInstance | null>(null);
  // True once the loaded answers are in the webform.
  const [formReady, setFormReady] = useState(false);
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

  const schema = snapshot.schema as FormType;
  // Built from the snapshot, so they keep their identity for the life of the form: Form.io resets
  // typed answers when its submission prop changes.
  const submissionProp = useMemo(
    () => ({ data: (snapshot.content?.data ?? {}) as Submission['data'] }),
    [snapshot],
  );
  // We own all submit messaging (success toast + redirect, inline error), so suppress Form.io's
  // built-in green "Submission Complete" alert.
  const formOptions = useMemo(
    () => ({ noAlerts: true, readOnly: !canWrite, ...fileOption }),
    [canWrite, fileOption],
  );

  // @formio/react applies the submission prop only after this callback, and Form.io applies it
  // asynchronously, so the loaded answers are set here and saving waits for them.
  const onFormReady = useCallback(
    (instance: FormInstance) => {
      formInstanceRef.current = instance;
      void instance.setSubmission(submissionProp).then(() => setFormReady(true));
    },
    [submissionProp],
  );

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
    setRenderError(
      apiErrorMessage(err, labels.errors, labels.requestFailed) ??
        normalizeFormioRenderError(err, labels.rendererError, labels.sessionExpired),
    );

  const runSave = async () => {
    const base = baseRevisionIdRef.current;
    const instance = formReady ? formInstanceRef.current : null;
    if (!base || !instance) return;
    setRenderError(null);
    const outcome = await writer.save(token ?? undefined, instance.submission.data ?? {}, base);
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
    const base = baseRevisionIdRef.current;
    if (!base) {
      setRenderError(labels.loadError);
      formInstanceRef.current?.emit('submitError', '');
      return;
    }
    setWriting('submit');
    try {
      const data = (submission?.data ?? {}) as Record<string, unknown>;
      const outcome = await writer.submit(token ?? undefined, data, base);
      if (outcome.status === 'held') {
        setRenderError(null);
        onHeld('submit', outcome.reason);
        // Releases the submit button without Form.io's success state.
        formInstanceRef.current?.emit('submitError', '');
        return;
      }
      addNotification({ text: labels.submitSuccess, type: 'success' });
      // Straight to the confirmation; navigating away unmounts the form, so there's no need to emit
      // `submitDone` and no flash of Form.io's own success screen. replace, so Back does not return
      // to the fill page of a submitted record.
      router.replace(`${submissionPath}/success`);
    } catch (err) {
      writeError(err);
      formInstanceRef.current?.emit('submitError', labels.rendererError);
    } finally {
      setWriting(null);
    }
  };

  // Discards the typed answers: the container mounts a new form on the latest bundle.
  const reloadLatest = async () => {
    setWriting('resolve');
    try {
      markHeld(null);
      await onReload();
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
      {canSaveDraft ? (
        <div className="mb-3 d-flex gap-2" data-testid="submission-fill-actions">
          <Button
            variant="secondary"
            onPress={() => {
              saveDraft().catch(writeError);
            }}
            isDisabled={!formReady || writing !== null || held !== null}
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
