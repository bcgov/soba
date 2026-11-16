'use client';

import { useMemo, useRef, useState } from 'react';
import { InlineAlert } from '@bcgov/design-system-react-components';

import FormSettingsDrawers from '@/src/features/form-settings/ui/FormSettingsDrawers';
import { useWorkspaceSettings } from '@/src/features/form-settings/data/useWorkspaceSettings';
import {
  CONFIRMATION_SETTINGS,
  CONFIRMATION_SETTINGS_KEY,
  type ConfirmationSettings,
} from '@/src/types/formSettings';
import type { Dictionary } from '@/src/types/dictionary';
import { messageForDataError } from '@/src/shared/api/dataError';
import { isConflict } from '@/src/shared/api/sobaHelpers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { CONFIRMATION_DRAWER_ID } from '../constants';
import type { ConfirmationScreenAvailability } from '../data/useConfirmationScreenAvailable';
import ConfirmationSettingControls from './ConfirmationSettingControls';

const OFF: ConfirmationSettings = { allowSubmitterEmailCopy: false, showConfirmationId: false };

const sameSettings = (a: ConfirmationSettings, b: ConfirmationSettings): boolean =>
  CONFIRMATION_SETTINGS.every((setting) => a[setting] === b[setting]);

/** What the confirmation screen offers on the workspace's forms, unless a form sets its own. */
export default function WorkspaceConfirmationDrawer({
  dict,
  workspaceId,
  availability,
}: Readonly<{
  dict: Dictionary;
  workspaceId: string;
  availability: ConfirmationScreenAvailability;
}>) {
  const t = dict.postSubmission.confirmationScreen;
  const s = dict.form.settings;
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const {
    settings,
    error: settingsError,
    save,
  } = useWorkspaceSettings<ConfirmationSettings>(CONFIRMATION_SETTINGS_KEY, workspaceId);

  // Null means no edit, so a refresh shows through until the user changes something.
  const [edited, setEdited] = useState<ConfirmationSettings | null>(null);
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

  const values = edited ?? settings?.values ?? OFF;

  const saveChanges = async () => {
    if (!token || !settings || !edited || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await save(token, { values: edited, version: settings.version });
      setEdited(null);
      addNotification({ type: 'success', text: s.formSettingsDrawerSaveSuccessMessage });
    } catch (err) {
      // Someone else saved first: the hook has read their change, so the stale edit goes.
      if (isConflict(err)) setEdited(null);
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
      onCancel={() => setEdited(null)}
      canSave={!!settings && !saving && edited !== null && !sameSettings(edited, settings.values)}
    >
      {readErrorMessage && (
        <InlineAlert
          variant="warning"
          title={readErrorMessage}
          data-testid="workspace-confirmation-error"
        />
      )}
      <ConfirmationSettingControls
        dict={dict}
        values={values}
        availability={availability}
        isDisabled={saving || !settings}
        onChange={setEdited}
        testIdPrefix="workspace-confirmation"
      />
    </FormSettingsDrawers>
  );
}
