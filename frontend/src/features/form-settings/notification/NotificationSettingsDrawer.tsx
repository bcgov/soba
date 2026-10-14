'use client';
import { useRef, useState } from 'react';
import {
  Button,
  InlineAlert,
  TagGroup,
  TagList,
  TextField,
} from '@bcgov/design-system-react-components';
import {
  NOTIFICATION_SETTINGS_KEY,
  NotificationSettingsSchema,
  type FormNotificationSettings,
} from '@soba/lib';
import FormSettingsDrawers from '../ui/FormSettingsDrawers';
import { useFormSettings } from '../data/useFormSettings';
import type { FormSettingsSectionProps } from '../types';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { isConflict } from '@/src/shared/api/sobaHelpers';
import { messageForDataError } from '@/src/shared/api/dataError';

export default function NotificationSettingsDrawer({
  dict,
  drawerName,
  formId,
}: FormSettingsSectionProps) {
  const t = dict.form.settings;
  const { token } = useKeycloak();
  const { settings, error, save } = useFormSettings<FormNotificationSettings>(
    NOTIFICATION_SETTINGS_KEY,
    formId,
  );
  const { addNotification } = useNotificationStore();
  const [edited, setEdited] = useState<string[] | null>(null);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const recipients = edited ?? settings?.values.recipients ?? [];
  const disabled = !settings || !!error || saving;
  const parsed = NotificationSettingsSchema.safeParse({ recipients: [email] });
  const candidate = parsed.success
    ? [...new Set([...recipients, ...parsed.data.recipients])]
    : null;
  const valid = candidate !== null && candidate.length <= 100;
  const clearInput = () => setEmail('');
  const cancelChanges = () => {
    setEdited(null);
    clearInput();
  };
  const addRecipient = () => {
    if (disabled || !valid || !candidate) return;
    setEdited(candidate);
    clearInput();
  };
  const saveChanges = async () => {
    if (!token || !settings || email.trim() !== '' || edited === null || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await save(token, { values: { recipients }, version: settings.version });
      setEdited(null);
      addNotification({ type: 'success', text: t.formSettingsDrawerSaveSuccessMessage });
    } catch (err) {
      if (isConflict(err)) setEdited(null);
      addNotification({
        type: 'error',
        text: isConflict(err) ? t.settingsConflictMessage : t.formSettingsDrawerSaveErrorMessage,
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <FormSettingsDrawers
      dict={dict}
      id={drawerName}
      label={t.notificationSettingsDrawerLabel}
      onSave={saveChanges}
      onCancel={cancelChanges}
      canSave={!!settings && !error && edited !== null && !email.trim() && !saving}
    >
      {error && (
        <InlineAlert
          variant="warning"
          title={messageForDataError(error, {
            sessionExpired: dict.general.sessionExpired,
            forbidden: dict.general.noAccess,
            failed: t.notificationSettingsLoadError,
          })}
          data-testid="form-settings-notification-error"
        />
      )}
      <TextField
        label={t.notificationRecipientsLabel}
        value={email}
        onChange={setEmail}
        isDisabled={disabled}
        isInvalid={!!email.trim() && !valid}
        errorMessage={t.notificationRecipientsInvalid}
        className="w-100"
        data-testid="form-settings-notification-recipients"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            addRecipient();
          }
        }}
      />
      <div className="d-flex gap-2 mt-2">
        <Button type="button" onClick={addRecipient} isDisabled={disabled || !valid}>
          {t.notificationRecipientAdd}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={clearInput}
          isDisabled={disabled || !email}
        >
          {dict.general.cancel}
        </Button>
      </div>
      <p className="mt-2">{t.notificationRecipientsHelp}</p>
      <TagGroup
        aria-label={t.notificationRecipientsLabel}
        onRemove={(keys) => {
          if (!disabled) setEdited(recipients.filter((address) => !keys.has(address)));
        }}
      >
        <TagList
          items={recipients.map((address) => ({
            id: address,
            textValue: address,
            color: 'gray',
            tagStyle: 'circular',
            isDisabled: disabled,
          }))}
        />
      </TagGroup>
    </FormSettingsDrawers>
  );
}
