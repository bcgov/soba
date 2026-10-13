'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { InlineAlert } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useDictionary } from '@/app/[lang]/Providers';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import { canSaveDraftOnSubmission, canWriteSubmission } from '@/src/shared/util/permissions';
import { useBcgovFileOption } from '@/src/features/formio-v5/useBcgovFileOption';
import { useSubmitFill } from '@/src/features/formio-v5/data/useSubmitFill';
import {
  SubmissionFillForm,
  type FillLabels,
} from '@/src/features/formio-v5/ui/SubmissionFillForm';
import { SubmissionLoadAlert } from '@/src/features/submissions/ui/SubmissionLoadAlert';
import { useAccessCaller } from '@/src/shared/api/useAccessCaller';
import type { SubmitFillBundle } from '@/src/types/forms';

/** What one load mounted the form with: the bundle, and the decisions over it. */
interface MountedLoad {
  loadId: number;
  bundle: SubmitFillBundle;
  canWrite: boolean;
  canSaveDraft: boolean;
}

/**
 * The load the form shows. A load keeps the bundle it mounted with, so a later read that empties or
 * fails it, such as the re-read when the session ends, leaves the typed answers alone. Its decisions
 * only widen, as when the provider arrives after a failed /me; the next load decides afresh.
 */
const nextMount = (
  held: MountedLoad | null,
  live: MountedLoad | null,
  loadId: number,
): MountedLoad | null => {
  const current = held?.loadId === loadId ? held : null;
  if (!current || !live) return current ?? live;
  const widens =
    (live.canWrite && !current.canWrite) || (live.canSaveDraft && !current.canSaveDraft);
  return widens
    ? {
        ...current,
        canWrite: current.canWrite || live.canWrite,
        canSaveDraft: current.canSaveDraft || live.canSaveDraft,
      }
    : current;
};

/**
 * Loads an already-opened submission for filling and decides, with the @soba/lib rules over the
 * bundle's facts, whether the caller may write it and save a draft. The form mounts once the
 * bundle, the caller and the file limits are known, since Form.io reads its options only then.
 */
function SubmissionFill({
  submissionId,
  labels,
}: Readonly<{
  submissionId: string;
  labels: FillLabels;
}>) {
  const router = useRouter();
  const locale = getLocaleFromPath(usePathname());
  const fill = useSubmitFill(submissionId);
  const { caller, pending: callerPending } = useAccessCaller();
  const files = useBcgovFileOption();
  // Each load the filler asks for mounts a new form; no other bundle reaches Form.io.
  const [loadId, setLoadId] = useState(0);
  const [held, setHeld] = useState<MountedLoad | null>(null);

  const bundle = fill.data;
  const submitted = bundle?.workflowState === 'submitted';
  const submissionPath = `/${locale}/submission/${submissionId}`;

  useEffect(() => {
    if (submitted) router.replace(submissionPath);
  }, [submitted, submissionPath, router]);

  const { refresh } = fill;
  const reload = useCallback(async () => {
    await refresh();
    setLoadId((id) => id + 1);
  }, [refresh]);

  // A submitted submission isn't fillable; the effect above leaves for its view.
  const ready = !!bundle && !fill.error && !submitted && !callerPending && files.ready;
  let live: MountedLoad | null = null;
  if (ready) {
    const access = { role: bundle.role, workflowState: bundle.workflowState };
    live = {
      loadId,
      bundle,
      canWrite: canWriteSubmission(access, bundle.form, caller),
      canSaveDraft: canSaveDraftOnSubmission(access, bundle.form, caller),
    };
  }
  const mounted = nextMount(held, live, loadId);
  if (mounted !== held) setHeld(mounted);

  if (!mounted) {
    return fill.error ? (
      <SubmissionLoadAlert error={fill.error} />
    ) : (
      <CenteredProgress label={labels.loading} />
    );
  }

  const { canWrite, canSaveDraft } = mounted;
  return (
    <SubmissionFillForm
      // A wider decision mounts a new form; it can only open the form up, so no typed answers are lost.
      key={`${mounted.loadId}:${canWrite}:${canSaveDraft}`}
      submissionId={submissionId}
      submissionPath={submissionPath}
      view={{ snapshot: mounted.bundle, canWrite, canSaveDraft, fileOption: files.option }}
      labels={labels}
      onReload={reload}
    />
  );
}

export default function FormioV5SubmissionFillClient({
  submissionId,
}: Readonly<{ submissionId: string }>) {
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
      <SubmissionFill
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
          savedAt: labels.savedAt,
          notSaved: labels.notSaved,
          notConfirmed: labels.notConfirmed,
          offline: labels.offline,
          heldSave: labels.heldSave,
          heldSubmit: labels.heldSubmit,
          reloadLatest: labels.reloadLatest,
          saveMine: labels.saveMine,
          submitMine: labels.submitMine,
          alreadySubmitted: labels.alreadySubmitted,
          requestFailed: labels.requestFailed,
          errors: dict.apiErrors,
        }}
      />
    </div>
  );
}
