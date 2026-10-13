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

  if (fill.error) {
    return <SubmissionLoadAlert error={fill.error} />;
  }

  // A submitted submission isn't fillable; the effect above leaves for its view.
  if (!bundle || submitted || callerPending || !files.ready) {
    return <CenteredProgress label={labels.loading} />;
  }

  const access = { role: bundle.role, workflowState: bundle.workflowState };
  const canWrite = canWriteSubmission(access, bundle.form, caller);
  const canSaveDraft = canSaveDraftOnSubmission(access, bundle.form, caller);
  return (
    <SubmissionFillForm
      // A changed decision, such as the caller's provider arriving after a failed /me, mounts a new
      // form. It can only open the form up, so no typed answers are lost.
      key={`${loadId}:${canWrite}:${canSaveDraft}`}
      submissionId={submissionId}
      submissionPath={submissionPath}
      view={{ snapshot: bundle, canWrite, canSaveDraft, fileOption: files.option }}
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
