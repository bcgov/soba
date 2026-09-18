'use client';

import { useState, useMemo } from 'react';
import { TextArea, TextField } from '@bcgov/design-system-react-components';

import type { Dictionary } from '@/src/types/dictionary';
import FormSettingsDrawers from '@/src/features/designer/ui/FormSettingsDrawers';
import { FormSubmitterAudience } from './FormSubmitterAudience';
import { updateSobaForm } from '@/src/shared/api/sobaApiDesign';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useForm } from '@/src/features/designer/useForm';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { useFormCreateWorkspaceOptions, useWorkspace } from '@/src/shared/api/useWorkspaces';
import { isWorkspaceManageRole } from '@/src/features/workspaces/workspaceRoles';

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
  const [editedName, setEditedName] = useState<string | null>(null);

  const selectedWorkspaceId = form?.workspaceId ?? null;

  const [saving, setSaving] = useState(false);

  const description = editedDescription ?? form?.description ?? '';
  const formName = editedName ?? form?.name ?? '';

  const { workspace: formWorkspace } = useWorkspace(formId ? form?.workspaceId : undefined);
  const creatableWorkspaces = useFormCreateWorkspaceOptions(false);

  const activeWorkspace = formId
    ? formWorkspace
    : creatableWorkspaces.workspaces.find((w) => w.id === selectedWorkspaceId);
  const canManageWorkspace = !!activeWorkspace && isWorkspaceManageRole(activeWorkspace.role);

  const edited = useMemo(() => {
    return editedName !== null || editedDescription !== null;
  }, [editedName, editedDescription]);

  const saveChanges = async () => {
    if (token !== undefined) {
      setSaving(true);
      try {
        const payload: { name?: string; description?: string } = {};
        if (editedName !== null) {
          payload.name = editedName;
        }
        if (editedDescription !== null) {
          payload.description = editedDescription;
        }
        if (Object.keys(payload).length === 0) {
          setSaving(false);
          return; //no changes
        }
        await updateSobaForm(token, formId, payload);
        await refreshForm();
        setEditedDescription(null);
        setEditedName(null);
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
    setEditedName(null);
  };

  return (
    <FormSettingsDrawers
      dict={dict}
      id={drawerName}
      label={dict.form.settings.formSettingsDrawerLabel}
      onSave={saveChanges}
      onCancel={cancelChanges}
      canSave={!saving && edited}
    >
      <TextField
        label={dict.form.nameLabel}
        value={formName}
        isDisabled={saving}
        data-testid="form-settings-name"
        onChange={(newName) => setEditedName(newName)}
      />
      <TextArea
        id="form-settings-description"
        className="bcds-react-aria-TextArea w-100"
        label={dict.form.descriptionLabel}
        value={description}
        isDisabled={saving}
        data-testid="form-settings-description"
        onChange={(newDescription) => setEditedDescription(newDescription)}
      />
      <FormSubmitterAudience
        key={selectedWorkspaceId ?? 'none'}
        workspaceId={selectedWorkspaceId}
        formId={formId}
        canManage={canManageWorkspace}
      />
    </FormSettingsDrawers>
  );
}
