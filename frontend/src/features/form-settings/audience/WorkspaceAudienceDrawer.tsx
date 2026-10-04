'use client';

import { useMemo, useRef, useState } from 'react';
import { InlineAlert } from '@bcgov/design-system-react-components';

import FormSettingsDrawers from '@/src/features/form-settings/ui/FormSettingsDrawers';
import type { WorkspaceSettingsSectionProps } from '@/src/features/form-settings/types';
import { useWorkspaceSettings } from '@/src/features/form-settings/data/useWorkspaceSettings';
import { AUDIENCE_SETTINGS_KEY, type Audience } from '@/src/types/formSettings';
import { useLoginProviders } from '@/src/shared/api/useLoginProviders';
import { messageForDataError } from '@/src/shared/api/dataError';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import AudienceField, { isValidAudience, toAudience, type AudienceValue } from './AudienceField';

/** The audience a workspace's forms use unless they set their own. */
export default function WorkspaceAudienceDrawer({
  dict,
  drawerName,
  workspaceId,
}: WorkspaceSettingsSectionProps) {
  const t = dict.form.settings;
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const {
    settings,
    error: settingsError,
    save,
  } = useWorkspaceSettings<Audience>(AUDIENCE_SETTINGS_KEY, workspaceId);
  const { data: providers, error: providersError } = useLoginProviders();

  // An edit layered over the loaded value. Null means no edit, so a refresh shows through until the
  // user changes it.
  const [edited, setEdited] = useState<AudienceValue | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const readError = settingsError ?? providersError;
  const readErrorMessage = useMemo(
    () =>
      readError
        ? messageForDataError(readError, {
            sessionExpired: dict.general.sessionExpired,
            forbidden: dict.general.noAccess,
            failed: t.audienceLoadError,
          })
        : null,
    [readError, dict.general.sessionExpired, dict.general.noAccess, t.audienceLoadError],
  );

  // Providers are needed to show and check a protected audience, so nothing changes until both load.
  const offered = providers ?? [];
  const loaded = !!settings && !!providers;
  const value = edited ?? settings ?? null;
  const canSave = loaded && !saving && !!value && isValidAudience(value, offered);

  const saveChanges = async () => {
    if (!token || !canSave || !value || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await save(token, toAudience(value, offered));
      setEdited(null);
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
      label={t.audienceDrawerLabel}
      onSave={saveChanges}
      onCancel={() => setEdited(null)}
      canSave={canSave}
    >
      {readErrorMessage && (
        <InlineAlert
          variant="warning"
          title={readErrorMessage}
          data-testid="workspace-settings-audience-error"
        />
      )}
      {value && (
        <AudienceField
          dict={dict}
          value={value}
          onChange={setEdited}
          providers={offered}
          isDisabled={!loaded || saving}
        />
      )}
    </FormSettingsDrawers>
  );
}
