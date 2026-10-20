'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  InlineAlert,
  TagGroup,
  TagList,
  TextField,
} from '@bcgov/design-system-react-components';

import FormSettingsDrawers from '@/src/features/form-settings/ui/FormSettingsDrawers';
import type { FormSettingsSectionProps } from '@/src/features/form-settings/types';
import { useFormSettings } from '@/src/features/form-settings/data/useFormSettings';
import {
  NOTIFICATION_RECIPIENTS_MAX,
  NOTIFICATION_SETTINGS_KEY,
  NotificationSettingsSchema,
  type FormNotificationSettings,
} from '@/src/types/formSettings';
import { messageForDataError } from '@/src/shared/api/dataError';
import { isConflict } from '@/src/shared/api/sobaHelpers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';

/** The address as the server stores it, or null when it is not a valid email. */
const normalizeAddress = (input: string): string | null => {
  const parsed = NotificationSettingsSchema.safeParse({ recipients: [input] });
  return parsed.success ? (parsed.data.recipients[0] ?? null) : null;
};

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((address, i) => address === b[i]);

type WithInput = { recipients: string[] } | { error: 'invalid' | 'limit' };

/** The list with the typed address added; a blank field or a listed address leaves it as is. */
const addTyped = (recipients: string[], input: string): WithInput => {
  if (!input.trim()) return { recipients };
  const address = normalizeAddress(input);
  if (!address) return { error: 'invalid' };
  if (recipients.includes(address)) return { recipients };
  if (recipients.length >= NOTIFICATION_RECIPIENTS_MAX) return { error: 'limit' };
  return { recipients: [...recipients, address] };
};

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
  const [inputError, setInputError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const focusInput = () => fieldRef.current?.querySelector('input')?.focus();

  // Focus moves to the field once its error renders, so a screen reader reads the error.
  useEffect(() => {
    if (inputError) fieldRef.current?.querySelector('input')?.focus();
  }, [inputError]);

  const stored = settings?.values.recipients ?? [];
  const recipients = edited ?? stored;
  const readOnly = !settings || !!error || saving;
  const changed = edited !== null && !sameList(edited, stored);
  const errorText = {
    invalid: t.notificationRecipientsInvalid,
    limit: t.notificationRecipientsLimit,
  };

  // Applies the typed address, or shows why it cannot be added. Null when it cannot.
  const takeInput = (): string[] | null => {
    const result = addTyped(recipients, email);
    if ('error' in result) {
      setInputError(errorText[result.error]);
      return null;
    }
    setEmail('');
    setInputError(null);
    return result.recipients;
  };

  const addRecipient = () => {
    if (readOnly) return;
    const next = takeInput();
    if (!next) return;
    setEdited(next);
    // The emptied field disables Add, which would drop keyboard focus.
    focusInput();
  };

  const removeRecipients = (keys: Set<unknown>) => {
    if (readOnly) return;
    setEdited(recipients.filter((address) => !keys.has(address)));
    setInputError(null);
  };

  const cancelChanges = () => {
    setEdited(null);
    setEmail('');
    setInputError(null);
  };

  const saveChanges = async () => {
    if (!token || !settings || readOnly || savingRef.current) return;
    const next = takeInput();
    if (!next) return;
    if (sameList(next, stored)) {
      setEdited(null);
      return;
    }
    setEdited(next);
    savingRef.current = true;
    setSaving(true);
    try {
      await save(token, { values: { recipients: next }, version: settings.version });
      setEdited(null);
      addNotification({ type: 'success', text: t.formSettingsDrawerSaveSuccessMessage });
    } catch (err) {
      // Someone else saved first: the hook has read their change, so the stale edit goes.
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
      canSave={!readOnly && (changed || email.trim() !== '')}
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
      <div ref={fieldRef}>
        <TextField
          label={t.notificationRecipientsLabel}
          description={t.notificationRecipientsHelp}
          value={email}
          onChange={(value) => {
            setEmail(value);
            setInputError(null);
          }}
          isDisabled={readOnly}
          isInvalid={!!inputError}
          errorMessage={inputError ?? undefined}
          // Native validation would let a shown error block the drawer's Save.
          validationBehavior="aria"
          data-testid="form-settings-notification-recipient-input"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addRecipient();
            }
          }}
        />
      </div>
      <div className="mt-2">
        <Button
          type="button"
          variant="secondary"
          onPress={addRecipient}
          isDisabled={readOnly || !email.trim()}
          data-testid="form-settings-notification-recipient-add"
        >
          {t.notificationRecipientAdd}
        </Button>
      </div>
      <div className="mt-3" data-testid="form-settings-notification-recipients">
        <TagGroup aria-label={t.notificationRecipientsLabel} onRemove={removeRecipients}>
          <TagList
            items={recipients.map((address) => ({
              id: address,
              textValue: address,
              color: 'gray',
              tagStyle: 'circular',
              isDisabled: readOnly,
              'data-testid': 'form-settings-notification-recipient',
            }))}
            renderEmptyState={() => t.notificationRecipientsEmpty}
          />
        </TagGroup>
      </div>
    </FormSettingsDrawers>
  );
}
