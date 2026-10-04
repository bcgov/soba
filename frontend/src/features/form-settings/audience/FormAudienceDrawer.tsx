'use client';

import { useMemo, useRef, useState } from 'react';
import { InlineAlert } from '@bcgov/design-system-react-components';

import FormSettingsDrawers from '@/src/features/form-settings/ui/FormSettingsDrawers';
import InheritCheckbox from '@/src/features/form-settings/ui/InheritCheckbox';
import { useInheritableEdit } from '@/src/features/form-settings/ui/useInheritableEdit';
import type { FormSettingsSectionProps } from '@/src/features/form-settings/types';
import { useFormSettings } from '@/src/features/form-settings/data/useFormSettings';
import {
  AUDIENCE_SETTINGS_KEY,
  type FormAudienceSettings,
  type SetFormAudienceSettingsBody,
} from '@/src/types/formSettings';
import { useLoginProviders } from '@/src/shared/api/useLoginProviders';
import { messageForDataError } from '@/src/shared/api/dataError';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import AudienceField, { isValidAudience, toAudience, type AudienceValue } from './AudienceField';

export default function FormAudienceDrawer({ dict, drawerName, formId }: FormSettingsSectionProps) {
  const t = dict.form.settings;
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const {
    settings,
    error: settingsError,
    save,
  } = useFormSettings<FormAudienceSettings, SetFormAudienceSettingsBody>(
    AUDIENCE_SETTINGS_KEY,
    formId,
  );
  const { data: providers, error: providersError } = useLoginProviders();
  const edit = useInheritableEdit<AudienceValue>(settings);
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
  const body = edit.body();
  const canSave =
    loaded && !saving && !!body && (body.inherit === true || isValidAudience(body.values, offered));

  const saveChanges = async () => {
    if (!token || !canSave || !body || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await save(
        token,
        body.inherit === true ? body : { inherit: false, values: toAudience(body.values, offered) },
      );
      edit.reset();
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
      onCancel={edit.reset}
      canSave={canSave}
    >
      {readErrorMessage && (
        <InlineAlert
          variant="warning"
          title={readErrorMessage}
          data-testid="form-settings-audience-error"
        />
      )}
      <InheritCheckbox
        label={t.inheritWorkspaceLabel}
        isSelected={edit.inherit}
        onChange={edit.setInherit}
        isDisabled={!loaded || saving}
        testId="form-settings-audience-inherit"
      />
      {edit.values && (
        <AudienceField
          dict={dict}
          value={edit.values}
          onChange={edit.setValues}
          providers={offered}
          isDisabled={!loaded || saving || edit.inherit}
        />
      )}
    </FormSettingsDrawers>
  );
}
