import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';
import en from '@/dictionaries/en.json';
import type { Dictionary } from '@/src/types/dictionary';
import type { FormConfirmationSettings } from '@/src/types/formSettings';
import { ApiError } from '@/src/shared/api/sobaHelpers';

const {
  mockGetFormSettings,
  mockSetFormSettings,
  mockGetWorkspaceSettings,
  mockSetWorkspaceSettings,
  mockAddNotification,
} = vi.hoisted(() => ({
  mockGetFormSettings: vi.fn(),
  mockSetFormSettings: vi.fn(),
  mockGetWorkspaceSettings: vi.fn(),
  mockSetWorkspaceSettings: vi.fn(),
  mockAddNotification: vi.fn(),
}));

vi.mock('@/src/features/form-settings/data/api', () => ({
  getFormSettings: mockGetFormSettings,
  setFormSettings: mockSetFormSettings,
  getWorkspaceSettings: mockGetWorkspaceSettings,
  setWorkspaceSettings: mockSetWorkspaceSettings,
  getWorkspaceInheritingForms: vi.fn(),
}));

vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification: mockAddNotification }),
}));

import { AccordionGroup } from '@bcgov/design-system-react-components';
import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import FormConfirmationDrawer from '@/src/features/submitter-email-copy/ui/FormConfirmationDrawer';
import WorkspaceConfirmationDrawer from '@/src/features/submitter-email-copy/ui/WorkspaceConfirmationDrawer';

const dict: Dictionary = en;
const t = dict.postSubmission.confirmationScreen;
const s = dict.form.settings;

let store: ReturnType<typeof makeStore>;

const renderOpen = (drawer: React.ReactNode) =>
  render(
    <Provider store={store}>
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
      >
        <AccordionGroup defaultExpandedKeys={['confirmation-screen']}>{drawer}</AccordionGroup>
      </SWRConfig>
    </Provider>,
  );

const input = (testId: string) =>
  screen.getByTestId(testId).querySelector('input') as HTMLInputElement;
const saveButton = () => screen.getByTestId('form-settings-confirmation-screen-save');

beforeEach(() => {
  vi.clearAllMocks();
  store = makeStore();
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
});

describe('WorkspaceConfirmationDrawer', () => {
  const allow = () => input('workspace-confirmation-allow-email-copy');
  const renderDrawer = () =>
    renderOpen(<WorkspaceConfirmationDrawer dict={dict} workspaceId="ws1" />);

  it('shows the saved setting under the Confirmation Screen card', async () => {
    mockGetWorkspaceSettings.mockResolvedValue({
      values: { allowSubmitterEmailCopy: true },
      version: 3,
    });
    renderDrawer();
    await waitFor(() => expect(allow()).toBeEnabled());
    expect(screen.getByText(t.label)).toBeInTheDocument();
    expect(screen.getByText(t.allowEmailCopy)).toBeInTheDocument();
    expect(allow()).toBeChecked();
    expect(mockGetWorkspaceSettings).toHaveBeenCalledWith('token', 'ws1', 'confirmation');
  });

  it('keeps Save off until something changes, then saves with the version read', async () => {
    const user = userEvent.setup();
    mockGetWorkspaceSettings.mockResolvedValue({
      values: { allowSubmitterEmailCopy: true },
      version: 3,
    });
    mockSetWorkspaceSettings.mockResolvedValue({
      values: { allowSubmitterEmailCopy: false },
      version: 4,
    });
    renderDrawer();
    await waitFor(() => expect(allow()).toBeEnabled());
    expect(saveButton()).toBeDisabled();

    await user.click(screen.getByText(t.allowEmailCopy));
    await user.click(saveButton());

    await waitFor(() =>
      expect(mockSetWorkspaceSettings).toHaveBeenCalledWith('token', 'ws1', 'confirmation', {
        values: { allowSubmitterEmailCopy: false },
        version: 3,
      }),
    );
    expect(mockAddNotification).toHaveBeenCalledWith({
      type: 'success',
      text: s.formSettingsDrawerSaveSuccessMessage,
    });
  });

  it('turns Save off again when the change is undone', async () => {
    const user = userEvent.setup();
    mockGetWorkspaceSettings.mockResolvedValue({
      values: { allowSubmitterEmailCopy: true },
      version: 3,
    });
    renderDrawer();
    await waitFor(() => expect(allow()).toBeEnabled());

    await user.click(screen.getByText(t.allowEmailCopy));
    expect(saveButton()).toBeEnabled();
    await user.click(screen.getByText(t.allowEmailCopy));
    expect(saveButton()).toBeDisabled();
  });

  it('says someone else saved first, and drops the stale edit', async () => {
    const user = userEvent.setup();
    mockGetWorkspaceSettings.mockResolvedValue({
      values: { allowSubmitterEmailCopy: true },
      version: 3,
    });
    mockSetWorkspaceSettings.mockRejectedValue(new ApiError('changed', 409));
    renderDrawer();
    await waitFor(() => expect(allow()).toBeEnabled());

    await user.click(screen.getByText(t.allowEmailCopy));
    await user.click(saveButton());

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'error',
        text: s.settingsConflictMessage,
      }),
    );
    await waitFor(() => expect(allow()).toBeChecked());
  });

  it('says when the settings could not be loaded, and cannot change', async () => {
    mockGetWorkspaceSettings.mockRejectedValue(new ApiError('boom', 500));
    renderDrawer();
    expect(await screen.findByTestId('workspace-confirmation-error')).toHaveTextContent(
      t.loadError,
    );
    expect(allow()).toBeDisabled();
  });
});

describe('FormConfirmationDrawer', () => {
  const allow = () => input('form-confirmation-allow-email-copy');
  const inheritBox = () => input('form-confirmation-inherit');
  const renderDrawer = () => renderOpen(<FormConfirmationDrawer dict={dict} formId="f1" />);

  const inherited = (allowSubmitterEmailCopy: boolean): FormConfirmationSettings => ({
    inherit: true,
    own: null,
    workspace: { allowSubmitterEmailCopy },
    effective: { allowSubmitterEmailCopy },
    version: 1,
  });

  it('shows the workspace value read-only while the form inherits', async () => {
    mockGetFormSettings.mockResolvedValue(inherited(true));
    renderDrawer();
    await waitFor(() => expect(inheritBox()).toBeEnabled());
    expect(inheritBox()).toBeChecked();
    expect(allow()).toBeChecked();
    expect(allow()).toBeDisabled();
  });

  it("saves the form's own value once inherit is turned off", async () => {
    const user = userEvent.setup();
    mockGetFormSettings.mockResolvedValue(inherited(true));
    mockSetFormSettings.mockResolvedValue({
      inherit: false,
      own: { allowSubmitterEmailCopy: false },
      workspace: { allowSubmitterEmailCopy: true },
      effective: { allowSubmitterEmailCopy: false },
      version: 2,
    });
    renderDrawer();
    await waitFor(() => expect(inheritBox()).toBeEnabled());

    await user.click(screen.getByText(s.inheritWorkspaceLabel));
    expect(allow()).toBeEnabled();
    await user.click(screen.getByText(t.allowEmailCopy));
    await user.click(saveButton());

    await waitFor(() =>
      expect(mockSetFormSettings).toHaveBeenCalledWith('token', 'f1', 'confirmation', {
        inherit: false,
        values: { allowSubmitterEmailCopy: false },
        version: 1,
      }),
    );
  });

  it('goes back to the workspace value and saves inherit only', async () => {
    const user = userEvent.setup();
    mockGetFormSettings.mockResolvedValue({
      inherit: false,
      own: { allowSubmitterEmailCopy: false },
      workspace: { allowSubmitterEmailCopy: true },
      effective: { allowSubmitterEmailCopy: false },
      version: 2,
    });
    mockSetFormSettings.mockResolvedValue(inherited(true));
    renderDrawer();
    await waitFor(() => expect(inheritBox()).toBeEnabled());
    expect(allow()).not.toBeChecked();

    await user.click(screen.getByText(s.inheritWorkspaceLabel));
    expect(allow()).toBeChecked();
    await user.click(saveButton());

    await waitFor(() =>
      expect(mockSetFormSettings).toHaveBeenCalledWith('token', 'f1', 'confirmation', {
        inherit: true,
        version: 2,
      }),
    );
  });
});
