'use client';

import { useState, useMemo } from 'react';
import { Select } from '@bcgov/design-system-react-components';

import type { Dictionary } from '@/src/types/plugins';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
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

  const [ministryOrg, setMinistryOrg] = useState(form?.org || '');
  const [initialMinistryOrg, setInitialMinistryOrg] = useState(form?.org || '');

  const [useCase, setUseCase] = useState(form?.useCase || '');
  const [initialUseCase, setInitialUseCase] = useState(form?.useCase || '');

  const [saving, setSaving] = useState(false);
  const [prevFormId, setPrevFormId] = useState<string | null>(null);

  if (form && form.id !== prevFormId) {
    setMinistryOrg(form.org || '');
    setInitialMinistryOrg(form.org || '');
    setUseCase(form.useCase || '');
    setInitialUseCase(form.useCase || '');
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
        setInitialMinistryOrg(ministryOrg);
        setInitialUseCase(useCase);
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
    setMinistryOrg(initialMinistryOrg);
    setUseCase(initialUseCase);
  };

  if (loading) {
    return <CenteredProgress label={dict.general.loading} />;
  }

  return (
    <FormSettingsDrawers
      id={drawerName}
      label={dict.form.settings.profileDrawerLabel}
      onSave={saveChanges}
      onCancel={cancelChanges}
    >
      <p>{dict.form.settings.profileDrawerInfo}</p>
      <Select
        items={codeItems(dict.ministries, initialMinistryOrg)}
        label={dict.workspaces.yourOrgReq}
        selectionMode="single"
        size="medium"
        data-testid="form-profile-org"
        isRequired={true}
        isDisabled={saving}
        value={ministryOrg}
        onChange={(newOrg) => setMinistryOrg(newOrg)}
      />
      <Select
        items={codeItems(dict.useCases, initialUseCase)}
        label={dict.workspaces.useCase}
        selectionMode="single"
        size="medium"
        data-testid="workspace-use-case"
        isRequired={true}
        isDisabled={saving}
        value={useCase}
        onChange={(newUseCase) => setUseCase(newUseCase)}
      />
    </FormSettingsDrawers>
  );
}
