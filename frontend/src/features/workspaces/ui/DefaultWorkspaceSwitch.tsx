'use client';

import { useState } from 'react';
import { Switch } from '@bcgov/design-system-react-components';
import { useAppDispatch } from '@/lib/store';
import { updateDefaultWorkspace } from '@/lib/slices/currentUserSlice';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';

type DefaultWorkspaceSwitchProps = {
  workspaceId: string;
  workspaceName: string;
  defaultWorkspaceId: string | null;
  ariaLabelTemplate: string;
  errorMessage: string;
};

export function DefaultWorkspaceSwitch({
  workspaceId,
  workspaceName,
  defaultWorkspaceId,
  ariaLabelTemplate,
  errorMessage,
}: DefaultWorkspaceSwitchProps) {
  const dispatch = useAppDispatch();
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const [pending, setPending] = useState(false);
  const isSelected = workspaceId === defaultWorkspaceId;

  const handleChange = (selected: boolean) => {
    if (!token || pending) return;
    setPending(true);
    void dispatch(
      updateDefaultWorkspace({
        token,
        defaultWorkspaceId: selected ? workspaceId : null,
      }),
    )
      .unwrap()
      .catch((error) => {
        addNotification({
          text: errorMessage,
          type: 'error',
          consoleError: error,
        });
      })
      .finally(() => {
        setPending(false);
      });
  };

  const ariaLabel = ariaLabelTemplate.replace('{name}', workspaceName);

  return (
    <Switch
      isSelected={isSelected}
      isDisabled={pending}
      aria-label={ariaLabel}
      onChange={handleChange}
      data-testid={`default-workspace-${workspaceId}`}
    />
  );
}
