'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Checkbox, InlineAlert } from '@bcgov/design-system-react-components';

import FormSettingsDrawers from '@/src/features/form-settings/ui/FormSettingsDrawers';
import type { FormSettingsSectionProps } from '@/src/features/form-settings/types';
import { useFormSettings } from '@/src/features/form-settings/data/useFormSettings';
import {
  SUBMITTER_SETTINGS_KEY,
  type SetSubmitterSettingsBody,
  type SubmitterSettings,
} from '@/src/types/formSettings';
import { useSubmitterAudience } from '@/src/features/designer/data/useSubmitterAudience';
import { FormSubmitterAudience } from '@/src/features/designer/ui/FormSubmitterAudience';
import { useForm } from '@/src/features/designer/data/useForm';
import { messageForDataError } from '@/src/shared/api/dataError';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';

export default function SubmitterSettingsDrawer({
  dict,
  drawerName,
  formId,
}: FormSettingsSectionProps) {
  const t = dict.form.settings;
  const { token } = useKeycloak();
  const {
    settings,
    error: settingsError,
    save,
  } = useFormSettings<SubmitterSettings, SetSubmitterSettingsBody>(SUBMITTER_SETTINGS_KEY, formId);
  const { addNotification } = useNotificationStore();
  const noteId = useId();
  const { form } = useForm(formId);
  const canUpdateForm = !!form?.permissions.some((p: string) => p === '*' || p === 'form_update');

  // Drafts are not offered to a Public audience. This is the form's effective audience: its own
  // override when it has one, otherwise the workspace audience it inherits.
  const { view: audience, error: audienceError } = useSubmitterAudience(null, formId);

  // An edit layered over the loaded value. Null means no edit, so a refresh shows through until the
  // user changes it.
  const [editedAllowDrafts, setEditedAllowDrafts] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const readError = settingsError ?? audienceError;
  const readErrorMessage = useMemo(
    () =>
      readError
        ? messageForDataError(readError, {
            sessionExpired: dict.general.sessionExpired,
            forbidden: dict.general.noAccess,
            failed: t.submitterSettingsLoadError,
          })
        : null,
    [readError, dict.general.sessionExpired, dict.general.noAccess, t.submitterSettingsLoadError],
  );

  // The setting changes only once the stored value and the audience are both known. On a Public
  // audience the stored value stands, including over an edit made before the audience changed.
  const isPublic = audience?.mode === 'public';
  const canEdit = !!settings && !!audience && !isPublic;
  const storedAllowDrafts = settings?.allowSubmitterDrafts ?? false;
  const allowSubmitterDrafts = canEdit
    ? (editedAllowDrafts ?? storedAllowDrafts)
    : storedAllowDrafts;

  const saveChanges = async () => {
    if (!token || !canEdit || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await save(token, { allowSubmitterDrafts });
      setEditedAllowDrafts(null);
      addNotification({ type: 'success', text: t.formSettingsDrawerSaveSuccessMessage });
    } catch {
      addNotification({ type: 'error', text: t.formSettingsDrawerSaveErrorMessage });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <FormSettingsDrawers
      dict={dict}
      id={drawerName}
      label={t.submitterSettingsDrawerLabel}
      onSave={saveChanges}
      onCancel={() => setEditedAllowDrafts(null)}
    >
      {readErrorMessage && (
        <InlineAlert
          variant="warning"
          title={readErrorMessage}
          data-testid="form-settings-submitter-settings-error"
        />
      )}
      <FormSubmitterAudience workspaceId={null} formId={formId} canManage={canUpdateForm} />
      <Checkbox
        isSelected={allowSubmitterDrafts}
        onChange={setEditedAllowDrafts}
        isDisabled={saving || !canEdit}
        aria-describedby={isPublic ? noteId : undefined}
        data-testid="form-settings-allow-drafts"
      >
        {t.allowSubmitterDraftsLabel}
      </Checkbox>
      {isPublic && (
        <div id={noteId}>
          <InlineAlert
            variant="info"
            title={t.allowSubmitterDraftsPublicNote}
            data-testid="form-settings-allow-drafts-public-note"
          />
        </div>
      )}
    </FormSettingsDrawers>
  );
}
