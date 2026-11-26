import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';
import en from '@/dictionaries/en.json';

// The new-form dialog with the real name check, store and SWR; only the requests are stubbed.

const { mockCheckNewFormName } = vi.hoisted(() => ({ mockCheckNewFormName: vi.fn() }));

vi.mock('@/src/shared/api/sobaApiDesign', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/shared/api/sobaApiDesign')>()),
  checkNewFormName: mockCheckNewFormName,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ lang: 'en' }),
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ authenticated: true, token: 'token', initializing: false }),
}));

vi.mock('@/app/[lang]/Providers', () => ({ useDictionary: () => en }));

vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification: vi.fn() }),
}));

vi.mock('@/src/shared/api/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: { capabilities: { formCreate: 'allowed' } }, loaded: true }),
}));

vi.mock('@/src/shared/api/useWorkspaces', () => ({
  useFormCreateWorkspaceOptions: () => ({
    workspaces: [{ id: 'ws-1', name: 'Workspace 1', role: 'owner' }],
    truncated: false,
  }),
}));

vi.mock('@/src/features/form-settings/data/useWorkspaceSettings', () => ({
  useFreshWorkspaceSettings: (_key: string, workspaceId: string | null) => ({
    settings: workspaceId ? { values: { mode: 'members', idps: [] }, version: 1 } : undefined,
    error: null,
  }),
}));

vi.mock('@/src/shared/api/useLoginProviders', () => ({
  useLoginProviders: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock('@/app/ui/WorkspaceSelector', () => ({
  WorkspaceSelector: ({
    selectedWorkspaceId,
    onChange,
  }: {
    selectedWorkspaceId: string | null;
    onChange: (id: string) => void;
  }) => (
    <select
      data-testid="workspace-selector"
      value={selectedWorkspaceId ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select workspace</option>
      <option value="ws-1">Workspace 1</option>
    </select>
  ),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { FormCreateContent } from '@/src/features/designer/ui/FormCreateContent';

const renderDialog = () => {
  const store = makeStore();
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
  return render(
    <Provider store={store}>
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
      >
        <FormCreateContent onCancelPress={vi.fn()} />
      </SWRConfig>
    </Provider>,
  );
};

const nameInput = () =>
  screen.getByTestId('form-name-modal').querySelector('input') as HTMLInputElement;

describe('FormCreateContent name check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckNewFormName.mockResolvedValue({ available: true });
  });

  it('says a name is available once it is typed in a chosen workspace', async () => {
    renderDialog();
    await userEvent.selectOptions(screen.getByTestId('workspace-selector'), 'ws-1');
    await userEvent.type(nameInput(), 'Permit');

    await waitFor(() =>
      expect(screen.getByTestId('form-name-modal')).toHaveTextContent(
        `${en.general.nameAvailable} ✓`,
      ),
    );
    expect(mockCheckNewFormName).toHaveBeenCalledWith('token', {
      workspaceId: 'ws-1',
      name: 'Permit',
    });
  });

  it('asks for a workspace to check against, then checks a name typed before it', async () => {
    renderDialog();
    expect(screen.getByTestId('form-name-modal')).toHaveTextContent(
      en.form.nameCheckNeedsWorkspace,
    );
    await userEvent.type(nameInput(), 'Permit');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(mockCheckNewFormName).not.toHaveBeenCalled();
    expect(screen.getByTestId('form-name-modal')).toHaveTextContent(
      en.form.nameCheckNeedsWorkspace,
    );

    await userEvent.selectOptions(screen.getByTestId('workspace-selector'), 'ws-1');
    expect(screen.getByTestId('form-name-modal')).not.toHaveTextContent(
      en.form.nameCheckNeedsWorkspace,
    );

    await waitFor(() =>
      expect(screen.getByTestId('form-name-modal')).toHaveTextContent(
        `${en.general.nameAvailable} ✓`,
      ),
    );
  });

  it('says a taken name is unavailable and keeps Next off', async () => {
    mockCheckNewFormName.mockResolvedValue({ available: false });
    renderDialog();
    await userEvent.selectOptions(screen.getByTestId('workspace-selector'), 'ws-1');
    await userEvent.type(nameInput(), 'Permit');

    await waitFor(() =>
      expect(screen.getByTestId('form-name-modal')).toHaveTextContent(
        `${en.general.nameUnavailable} ✕`,
      ),
    );
    expect(screen.getByTestId('save-create-form')).toBeDisabled();
  });
});
