'use client';

import { useState } from 'react';
import { TextArea } from '@bcgov/design-system-react-components';

import type { Dictionary } from '@/src/types/plugins';
import FormSettingsDrawers from '@/src/features/designer/ui/FormSettingsDrawers';
import { updateSobaForm } from '@/src/shared/api/sobaApiDesign';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useForm } from '@/src/features/designer/useForm';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';

interface FormSettingsDrawerProps {
  dict: Dictionary;
  drawerName: string;
  formId: string;
}

export default function FormSettingsDrawer({
  dict,
  drawerName,
  formId,
}: Readonly<FormSettingsDrawerProps>) {
  const { token } = useKeycloak();
  const { form, refreshForm } = useForm(formId);
  const { addNotification } = useNotificationStore();

  // An edit layered over the loaded value. Null means no edit, so a refresh from anywhere shows
  // through until the user types.
  const [editedDescription, setEditedDescription] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const description = editedDescription ?? form?.description ?? '';

  const saveChanges = async () => {
    if (token !== undefined) {
      setSaving(true);
      try {
        await updateSobaForm(token, formId, {
          description: description,
        });
        await refreshForm();
        setEditedDescription(null);
        addNotification({
          type: 'success',
          text:
            dict.form.settings.formSettingsDrawerSaveSuccessMessage ||
            'Changes saved successfully.',
        });
      } catch {
        addNotification({
          type: 'error',
          text:
            dict.form.settings.formSettingsDrawerSaveErrorMessage ||
            'Failed to save changes. Please try again.',
        });
      }
      setSaving(false);
    }
  };

  const cancelChanges = () => {
    setEditedDescription(null);
  };

  return (
    <FormSettingsDrawers
      dict={dict}
      id={drawerName}
      label={dict.form.settings.formSettingsDrawerLabel}
      onSave={saveChanges}
      onCancel={cancelChanges}
    >
      <TextArea
        id="form-settings-description"
        className="bcds-react-aria-TextArea w-100"
        label={dict.form.descriptionLabel}
        value={description}
        isDisabled={saving}
        data-testid="form-settings-description"
        onChange={(newDescription) => setEditedDescription(newDescription)}
      />
    </FormSettingsDrawers>
  );
}
