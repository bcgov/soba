'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { Form, TextField, Button, InlineAlert } from '@bcgov/design-system-react-components';
import { WorkspaceSelector } from '@/app/ui/WorkspaceSelector';
import { FormSubmitterAudience } from './FormSubmitterAudience';
import { useDictionary } from '@/app/[lang]/Providers';
import { useFormCreateWorkspaceOptions } from '@/src/shared/api/useWorkspaces';
import { isWorkspaceManageRole } from '@/src/features/workspaces/workspaceRoles';
import { lookupTruncatedNote } from '@/src/shared/list/lookupOptions';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { createSobaFormioForm } from '@/src/shared/api/sobaApi';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useCurrentUser } from '@/src/shared/api/useCurrentUser';
import { isConflict } from '@/src/shared/api/sobaHelpers';
import type { SobaFormType } from '@/src/types/forms';

interface FormCreateContentProps {
  onCancelPress: () => void;
}

export const FormCreateContent = ({ onCancelPress }: Readonly<FormCreateContentProps>) => {
  const dict = useDictionary();
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const { data: currentUser, loaded: currentUserLoaded } = useCurrentUser();
  const router = useRouter();
  const params = useParams();
  const lang = params.lang as string;

  const formCreate = currentUser?.capabilities?.formCreate;

  const [formName, setFormName] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const creatableWorkspaces = useFormCreateWorkspaceOptions(true);
  const activeWorkspace = creatableWorkspaces.workspaces.find((w) => w.id === selectedWorkspaceId);
  const canManageWorkspace = !!activeWorkspace && isWorkspaceManageRole(activeWorkspace.role);

  const reportWriteFailure = async (e: unknown, failedText: string) => {
    if (!isConflict(e)) {
      addNotification({ text: failedText, type: 'error', consoleError: e });
      return;
    }
    addNotification({ text: dict.form.versionConflict, type: 'error', consoleError: e });
  };

  const saveForm = async () => {
    if (isSaving) return;
    // Creating a form is workspace-scoped: without a selected workspace the backend
    // rejects the request with a generic error, so surface a clear message instead.
    if (!selectedWorkspaceId) {
      addNotification({ text: dict.form.noActiveWorkspaceError, type: 'error' });
      return;
    }
    setIsSaving(true);

    try {
      const data: SobaFormType = { name: formName };
      const created = await createSobaFormioForm(
        token as string,
        data,
        selectedWorkspaceId || undefined,
      );
      addNotification({
        text: dict.form.saved,
        type: 'success',
      });
      router.push(`/${lang}/build/${created.id}`);
    } catch (e: unknown) {
      await reportWriteFailure(e, dict.form.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  // New-form mode requires a workspace to own the form. When none qualifies, block designer access
  // with a clear prompt instead of a save failure. Having the permission but no accepted disclaimer
  // is actionable, so it gets its own message.
  if (currentUserLoaded && formCreate !== 'allowed') {
    const blocked =
      formCreate === 'disclaimer_required'
        ? {
            variant: 'warning' as const,
            testId: 'disclaimer-required-alert',
            text: dict.form.disclaimerRequired,
          }
        : {
            variant: 'info' as const,
            testId: 'designer-select-workspace',
            text: dict.form.noActiveWorkspace,
          };
    return (
      <div className="p-4">
        <InlineAlert variant={blocked.variant} data-testid={blocked.testId}>
          {blocked.text}
        </InlineAlert>
      </div>
    );
  }

  return (
    <Form
      onSubmit={(e) => e.preventDefault()}
      className="d-flex flex-column gap-3 mb-3"
      style={{ maxWidth: '640px' }}
    >
      <TextField
        label={dict.form.nameLabel}
        value={formName}
        onChange={setFormName}
        data-testid="form-name-modal"
      />

      {creatableWorkspaces.workspaces.length > 0 && (
        <WorkspaceSelector
          label={dict.workspaces.workspace}
          workspaces={creatableWorkspaces.workspaces}
          data-testid="form-workspace-modal"
          selectedWorkspaceId={selectedWorkspaceId}
          onChange={(id) => setSelectedWorkspaceId(id as string)}
          description={lookupTruncatedNote(dict.general.lookupTruncated, creatableWorkspaces)}
          size="medium"
        />
      )}

      <FormSubmitterAudience
        key={selectedWorkspaceId ?? 'none'}
        data-testid="form-audience-modal"
        workspaceId={selectedWorkspaceId}
        canManage={canManageWorkspace}
      />
      <div className="d-flex justify-content-end gap-2">
        <Button isDisabled={isSaving} variant="secondary" onPress={onCancelPress}>
          {dict.general.cancel}
        </Button>
        <Button isDisabled={isSaving} onPress={saveForm}>
          {dict.general.next}
        </Button>
      </div>
    </Form>
  );
};
