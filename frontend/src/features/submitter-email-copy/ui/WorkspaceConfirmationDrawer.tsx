'use client';

import { useMemo, useRef, useState } from 'react';
import { Checkbox, InlineAlert } from '@bcgov/design-system-react-components';

import FormSettingsDrawers from '@/src/features/form-settings/ui/FormSettingsDrawers';
import { useWorkspaceSettings } from '@/src/features/form-settings/data/useWorkspaceSettings';
import { CONFIRMATION_SETTINGS_KEY, type ConfirmationSettings } from '@/src/types/formSettings';
import type { Dictionary } from '@/src/types/dictionary';
import { messageForDataError } from '@/src/shared/api/dataError';
import { isConflict } from '@/src/shared/api/sobaHelpers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { CONFIRMATION_DRAWER_ID } from '../constants';

/** What the confirmation screen offers on the workspace's forms, unless a form sets its own. */
export default function WorkspaceConfirmationDrawer({
  dict,
  workspaceId,
}: Readonly<{ dict: Dictionary; workspaceId: string }>) {
  const t = dict.postSubmission.confirmationScreen;
  const s = dict.form.settings;
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const {
    settings,
    error: settingsError,
    save,
  } = useWorkspaceSettings<ConfirmationSettings>(CONFIRMATION_SETTINGS_KEY, workspaceId);

  const [editedAllowEmailCopy, setEditedAllowEmailCopy] = useState<boolean | null>(null);
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

  const allowSubmitterEmailCopy =
    editedAllowEmailCopy ?? settings?.values.allowSubmitterEmailCopy ?? false;

  const saveChanges = async () => {
    if (!token || !settings || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await save(token, { values: { allowSubmitterEmailCopy }, version: settings.version });
      setEditedAllowEmailCopy(null);
      addNotification({ type: 'success', text: s.formSettingsDrawerSaveSuccessMessage });
    } catch (err) {
      // Someone else saved first: the hook has read their change, so the stale edit goes.
      if (isConflict(err)) setEditedAllowEmailCopy(null);
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
      onCancel={() => setEditedAllowEmailCopy(null)}
      canSave={
        !!settings &&
        !saving &&
        editedAllowEmailCopy !== null &&
        editedAllowEmailCopy !== settings.values.allowSubmitterEmailCopy
      }
    >
      {readErrorMessage && (
        <InlineAlert
          variant="warning"
          title={readErrorMessage}
          data-testid="workspace-confirmation-error"
        />
      )}
      <Checkbox
        isSelected={allowSubmitterEmailCopy}
        onChange={setEditedAllowEmailCopy}
        isDisabled={saving || !settings}
        data-testid="workspace-confirmation-allow-email-copy"
      >
        {t.allowEmailCopy}
      </Checkbox>
    </FormSettingsDrawers>
  );
}
