'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { Form, TextField, Button, InlineAlert } from '@bcgov/design-system-react-components';
import { WorkspaceSelector } from '@/app/ui/WorkspaceSelector';
import { SubmitterAudienceControls } from './SubmitterAudienceControls';
import { useDictionary } from '@/app/[lang]/Providers';
import { useFormCreateWorkspaceOptions } from '@/src/shared/api/useWorkspaces';
import { lookupTruncatedNote } from '@/src/shared/list/lookupOptions';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { useFormCreator } from '@/src/features/designer/data/useForm';
import { useSubmitterAudience } from '@/src/features/designer/data/useSubmitterAudience';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useCurrentUser } from '@/src/shared/api/useCurrentUser';
import { isConflict } from '@/src/shared/api/sobaHelpers';
import type { SobaFormType } from '@/src/types/forms';
import type { SetFormSubmitterAudienceBody } from '@/src/types/groups';

interface FormCreateContentProps {
  onCancelPress: () => void;
}

export const FormCreateContent = ({ onCancelPress }: Readonly<FormCreateContentProps>) => {
  const dict = useDictionary();
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const { data: currentUser, loaded: currentUserLoaded } = useCurrentUser();
  const formCreator = useFormCreator();
  const router = useRouter();
  const params = useParams();
  const lang = params.lang as string;

  const formCreate = currentUser?.capabilities?.formCreate;

  const [formName, setFormName] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [mode, setMode] = useState<string>('inherit');
  const [idps, setIdps] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const { view: effectiveAudience } = useSubmitterAudience(selectedWorkspaceId, undefined);

  const creatableWorkspaces = useFormCreateWorkspaceOptions(true);

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
      const data: SobaFormType & { submitterAudience?: SetFormSubmitterAudienceBody } = {
        name: formName.trim(),
      };
      if (mode !== 'inherit') {
        data.submitterAudience =
          mode === 'public' ? { mode: 'public' } : { mode: 'protected', idps };
      }
      const outcome = await formCreator.create(
        token as string,
        data,
        selectedWorkspaceId || undefined,
      );

      // The version the form is created with holds no schema, and a read of one that has none is a
      // 404. Writing the empty schema here leaves the designer a draft it can open and publish.
      addNotification({
        text: dict.form.saved,
        type: 'success',
      });
      if (outcome.status === 'applied') {
        router.push(`/${lang}/build/${outcome.value.id}`);
      }
    } catch (e: unknown) {
      // A 409 carries the backend's own reason: the name is taken, or the workspace disclaimer is
      // unaccepted. Nothing in this dialog has versions, so the version-conflict wording is wrong.
      const conflict = isConflict(e) && e instanceof Error && e.message;
      addNotification({
        text: conflict ? e.message : dict.form.saveError,
        type: 'error',
        consoleError: e,
      });
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
      onSubmit={(e) => {
        e.preventDefault();
        saveForm();
      }}
      className="d-flex flex-column gap-3 mb-3"
      style={{ maxWidth: '640px' }}
    >
      <TextField
        label={dict.form.nameLabel}
        value={formName}
        onChange={setFormName}
        isRequired={true}
        validate={(value) => (value.trim() ? null : dict.form.noFormName)}
        errorMessage={dict.form.noFormName}
        data-testid="form-name-modal"
      />

      {creatableWorkspaces.workspaces.length > 0 && (
        <WorkspaceSelector
          label={dict.workspaces.workspace}
          workspaces={creatableWorkspaces.workspaces}
          selectedWorkspaceId={selectedWorkspaceId}
          isRequired={true}
          onChange={(id) => {
            setSelectedWorkspaceId(id as string);
            setMode('inherit');
            setIdps([]);
          }}
          description={lookupTruncatedNote(dict.general.lookupTruncated, creatableWorkspaces)}
          size="medium"
        />
      )}

      <div className="p-3 border rounded-3 bg-light">
        <SubmitterAudienceControls
          mode={mode}
          setMode={setMode}
          idps={idps}
          setIdps={setIdps}
          saving={isSaving}
          isForm={true}
          effectiveAudience={effectiveAudience ?? null}
          isDisabled={!selectedWorkspaceId}
        />
      </div>

      <div className="d-flex justify-content-end gap-2">
        <Button
          type="button"
          isDisabled={isSaving}
          variant="secondary"
          onPress={onCancelPress}
          data-testid="cancel-create-form"
        >
          {dict.general.cancel}
        </Button>
        <Button
          type="submit"
          isDisabled={isSaving || (mode === 'protected' && idps.length === 0)}
          data-testid="save-create-form"
        >
          {dict.general.next}
        </Button>
      </div>
    </Form>
  );
};
