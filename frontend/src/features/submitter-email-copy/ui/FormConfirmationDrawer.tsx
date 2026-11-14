'use client';

import { useMemo, useRef, useState } from 'react';
import { Checkbox, InlineAlert } from '@bcgov/design-system-react-components';

import FormSettingsDrawers from '@/src/features/form-settings/ui/FormSettingsDrawers';
import InheritCheckbox from '@/src/features/form-settings/ui/InheritCheckbox';
import { useInheritableEdit } from '@/src/features/form-settings/ui/useInheritableEdit';
import { useFormSettings } from '@/src/features/form-settings/data/useFormSettings';
import {
  CONFIRMATION_SETTINGS_KEY,
  type ConfirmationSettings,
  type FormConfirmationSettings,
  type SetFormConfirmationSettingsBody,
} from '@/src/types/formSettings';
import type { Dictionary } from '@/src/types/dictionary';
import { messageForDataError } from '@/src/shared/api/dataError';
import { isConflict } from '@/src/shared/api/sobaHelpers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { CONFIRMATION_DRAWER_ID } from '../constants';

/** What the form's confirmation screen offers: its own setting, or its workspace's. */
export default function FormConfirmationDrawer({
  dict,
  formId,
}: Readonly<{ dict: Dictionary; formId: string }>) {
  const t = dict.postSubmission.confirmationScreen;
  const s = dict.form.settings;
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const {
    settings,
    error: settingsError,
    save,
  } = useFormSettings<FormConfirmationSettings, SetFormConfirmationSettingsBody>(
    CONFIRMATION_SETTINGS_KEY,
    formId,
  );

  const edit = useInheritableEdit<ConfirmationSettings>(settings);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const readErrorMessage = useMemo(
    () =>
      settingsError
        ? messageForDataError(settingsError, {
            sessionExpired: dict.general.sessionExpired,
            forbidden: dict.general.noAccess,
            failed: t.loadError,
          })
        : null,
    [settingsError, dict.general.sessionExpired, dict.general.noAccess, t.loadError],
  );

  const canEdit = !!settings;
  // Before the settings load, the drawer shows inheriting and unticked, and cannot change.
  const inherit = edit.inherit;
  const allowSubmitterEmailCopy = edit.values?.allowSubmitterEmailCopy ?? false;

  const saveChanges = async () => {
    const body = edit.body();
    if (!token || !canEdit || !body || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await save(token, body);
      edit.reset();
      addNotification({ type: 'success', text: s.formSettingsDrawerSaveSuccessMessage });
    } catch (err) {
      // Someone else saved first: the hook has read their change, so the stale edit goes.
      if (isConflict(err)) edit.reset();
      addNotification({
        type: 'error',
        text: isConflict(err) ? s.settingsConflictMessage : s.formSettingsDrawerSaveErrorMessage,
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <FormSettingsDrawers
      dict={dict}
      id={CONFIRMATION_DRAWER_ID}
      label={t.label}
      onSave={saveChanges}
      onCancel={edit.reset}
      canSave={canEdit && edit.changed && !saving}
    >
      {readErrorMessage && (
        <InlineAlert
          variant="warning"
          title={readErrorMessage}
          data-testid="form-confirmation-error"
        />
      )}
      <InheritCheckbox
        label={s.inheritWorkspaceLabel}
        isSelected={inherit}
        onChange={edit.setInherit}
        isDisabled={saving || !canEdit}
        testId="form-confirmation-inherit"
      />
      <Checkbox
        isSelected={allowSubmitterEmailCopy}
        onChange={(allow) => edit.setValues({ allowSubmitterEmailCopy: allow })}
        isDisabled={saving || !canEdit || inherit}
        data-testid="form-confirmation-allow-email-copy"
      >
        {t.allowEmailCopy}
      </Checkbox>
    </FormSettingsDrawers>
  );
}
