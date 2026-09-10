'use client';

import { useState, useMemo } from 'react';
import { TextArea } from '@bcgov/design-system-react-components';

import type { Dictionary } from '@/src/types/plugins';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
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

  const [description, setDescription] = useState(form?.description || '');
  const [initialDescription, setInitialDescription] = useState(form?.description || '');
  const [saving, setSaving] = useState(false);
  const [prevFormId, setPrevFormId] = useState<string | null>(null);

  if (form && form.id !== prevFormId) {
    setDescription(form.description || '');
    setInitialDescription(form.description || '');
    setPrevFormId(form.id);
  }

  const loading = useMemo(() => {
    return form === null;
  }, [form]);

  const saveChanges = async () => {
    if (token !== undefined) {
      setSaving(true);
      try {
        await updateSobaForm(token, formId, {
          description: description,
        });
        await refreshForm();
        setInitialDescription(description);
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
    setDescription(initialDescription);
  };

  if (loading) {
    return <CenteredProgress label={dict.general.loading} />;
  }

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
        onChange={(newDescription) => setDescription(newDescription)}
      />
    </FormSettingsDrawers>
  );
}
