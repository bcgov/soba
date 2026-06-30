import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockDispatch = vi.fn();
const mockUnwrap = vi.fn().mockResolvedValue({
  preferences: { defaultWorkspaceId: 'ws2' },
});

vi.mock('@/lib/store', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ token: 'token' }),
}));

vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification: vi.fn() }),
}));

import { DefaultWorkspaceSwitch } from '@/src/features/workspaces/ui/DefaultWorkspaceSwitch';

describe('DefaultWorkspaceSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatch.mockReturnValue({ unwrap: mockUnwrap });
  });

  it('dispatches update when toggled on', async () => {
    await act(async () => {
      render(
        <DefaultWorkspaceSwitch
          workspaceId="ws2"
          workspaceName="Team Workspace"
          defaultWorkspaceId={null}
          ariaLabelTemplate="Set {name} as default workspace"
          errorMessage="Failed"
        />,
      );
    });

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);

    expect(mockDispatch).toHaveBeenCalled();
    expect(mockUnwrap).toHaveBeenCalled();
  });
});
