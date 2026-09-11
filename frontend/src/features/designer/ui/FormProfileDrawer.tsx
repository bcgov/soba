'use client';

import { useState } from 'react';
import { Select } from '@bcgov/design-system-react-components';

import type { Dictionary } from '@/src/types/plugins';
import FormSettingsDrawers from '@/src/features/designer/ui/FormSettingsDrawers';
import { codeItems } from '@/src/shared/util/codeList';
import { updateSobaForm } from '@/src/shared/api/sobaApiDesign';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useForm } from '@/src/features/designer/useForm';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';

interface FormProfileDrawerProps {
  dict: Dictionary;
  drawerName: string;
  formId: string;
}

export default function FormProfileDrawer({
  dict,
  drawerName,
  formId,
}: Readonly<FormProfileDrawerProps>) {
  const { token } = useKeycloak();
  const { form, refreshForm } = useForm(formId);
  const { addNotification } = useNotificationStore();

  // Edits layered over the loaded values. Null means no edit, so a refresh from anywhere shows
  // through until the user picks something.
  const [editedOrg, setEditedOrg] = useState<string | null>(null);
  const [editedUseCase, setEditedUseCase] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ministryOrg = editedOrg ?? form?.org ?? '';
  const useCase = editedUseCase ?? form?.useCase ?? '';

  const saveChanges = async () => {
    if (token !== undefined) {
      setSaving(true);
      try {
        await updateSobaForm(token, formId, {
          org: ministryOrg,
          useCase: useCase,
        });
        await refreshForm();
        addNotification({
          type: 'success',
          text:
            dict.form.settings.formSettingsDrawerSaveSuccessMessage ||
            'Changes saved successfully.',
        });
        setEditedOrg(null);
        setEditedUseCase(null);
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
    setEditedOrg(null);
    setEditedUseCase(null);
  };

  return (
    <FormSettingsDrawers
      dict={dict}
      id={drawerName}
      label={dict.form.settings.profileDrawerLabel}
      onSave={saveChanges}
      onCancel={cancelChanges}
    >
      <p>{dict.form.settings.profileDrawerInfo}</p>
      <Select
        items={codeItems(dict.ministries, form?.org)}
        label={dict.workspaces.yourOrgReq}
        selectionMode="single"
        size="medium"
        data-testid="form-profile-org"
        isRequired={true}
        isDisabled={saving}
        value={ministryOrg}
        onChange={(newOrg) => setEditedOrg(newOrg?.toString() ?? '')}
      />
      <Select
        items={codeItems(dict.useCases, form?.useCase)}
        label={dict.workspaces.useCase}
        selectionMode="single"
        size="medium"
        data-testid="form-profile-use-case"
        isRequired={true}
        isDisabled={saving}
        value={useCase}
        onChange={(newUseCase) => setEditedUseCase(newUseCase?.toString() ?? '')}
      />
    </FormSettingsDrawers>
  );
}
