'use client';

import { useId } from 'react';
import { Checkbox, InlineAlert } from '@bcgov/design-system-react-components';

import type { Dictionary } from '@/src/types/dictionary';
import type { ConfirmationSetting, ConfirmationSettings } from '@/src/types/formSettings';
import type { ConfirmationScreenAvailability } from '../data/useConfirmationScreenAvailable';

/** The settings the card can show, each with its own test id. */
const CONTROLS: readonly { setting: ConfirmationSetting; testId: string }[] = [
  { setting: 'showConfirmationId', testId: 'show-confirmation-id' },
  { setting: 'allowSubmitterEmailCopy', testId: 'allow-email-copy' },
];

/**
 * The Confirmation Screen card's checkboxes, at workspace or form level. A setting shows only where
 * its feature is available; the email copy says so when notifications are off.
 */
export default function ConfirmationSettingControls({
  dict,
  values,
  availability,
  isDisabled,
  onChange,
  testIdPrefix,
}: Readonly<{
  dict: Dictionary;
  values: ConfirmationSettings;
  availability: ConfirmationScreenAvailability;
  isDisabled: boolean;
  onChange: (values: ConfirmationSettings) => void;
  testIdPrefix: string;
}>) {
  const t = dict.postSubmission.confirmationScreen;
  const idPrefix = useId();
  const text: Record<ConfirmationSetting, { label: string; help: string }> = {
    showConfirmationId: { label: t.showConfirmationId, help: t.showConfirmationIdHelp },
    allowSubmitterEmailCopy: { label: t.allowEmailCopy, help: t.allowEmailCopyHelp },
  };
  const notificationsOff = !availability.notifications;

  return (
    <>
      {CONTROLS.filter(({ setting }) => availability.settings[setting]).map(
        ({ setting, testId }) => {
          const helpId = `${idPrefix}-${setting}-help`;
          const noteId = `${idPrefix}-${setting}-note`;
          const showNote = setting === 'allowSubmitterEmailCopy' && notificationsOff;
          return (
            <div key={setting} className="mb-2">
              <Checkbox
                isSelected={values[setting]}
                onChange={(selected) => onChange({ ...values, [setting]: selected })}
                isDisabled={isDisabled}
                aria-describedby={showNote ? `${helpId} ${noteId}` : helpId}
                data-testid={`${testIdPrefix}-${testId}`}
              >
                {text[setting].label}
              </Checkbox>
              <p id={helpId} className="small text-muted mb-1">
                {text[setting].help}
              </p>
              {showNote && (
                <div id={noteId}>
                  <InlineAlert
                    variant="info"
                    title={t.notificationsOff}
                    data-testid={`${testIdPrefix}-notifications-off`}
                  />
                </div>
              )}
            </div>
          );
        },
      )}
    </>
  );
}
