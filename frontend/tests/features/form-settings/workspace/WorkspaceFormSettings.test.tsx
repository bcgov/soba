import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';
import type { Dictionary } from '@/src/types/dictionary';
import type { Audience, SubmitterSettings } from '@/src/types/formSettings';
import { ApiError } from '@/src/shared/api/sobaHelpers';

const {
  mockGetForm,
  mockGetSettings,
  mockSetSettings,
  mockGetInheriting,
  mockGetProviders,
  mockAddNotification,
} = vi.hoisted(() => ({
  mockGetForm: vi.fn(),
  mockGetInheriting: vi.fn(),
  mockGetSettings: vi.fn(),
  mockSetSettings: vi.fn(),
  mockGetProviders: vi.fn(),
  mockAddNotification: vi.fn(),
}));

vi.mock('@/src/features/form-settings/data/api', () => ({
  getFormSettings: mockGetForm,
  getWorkspaceSettings: mockGetSettings,
  setWorkspaceSettings: mockSetSettings,
  getWorkspaceInheritingForms: mockGetInheriting,
}));

vi.mock('@/src/shared/api/sobaApi', () => ({
  fetchLoginProviders: mockGetProviders,
}));

// The confirmation dialog reads the dictionary from context.
vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => mockDict,
}));

vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification: mockAddNotification }),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import WorkspaceFormSettings from '@/src/features/form-settings/ui/WorkspaceFormSettings';
import { useFormSettings } from '@/src/features/form-settings/data/useFormSettings';

const DRAFTS = 'Allow Submitters to Save and Edit Drafts';
const PUBLIC_NOTE = 'Drafts are not available for Public forms.';
const REQUIRED = 'Select at least one login.';

const mockDict = {
  form: {
    save: 'Save',
    settings: {
      audienceDrawerLabel: 'Form Audience',
      audienceLabel: 'Who can submit',
      audiencePublic: 'Public',
      audienceProtected: 'Protected',
      audienceMembers: 'Members only',
      audienceProviders: 'Allowed logins',
      audienceProvidersRequired: REQUIRED,
      audienceLoadError: 'Could not load the form audience.',
      audiencePublicConfirmTitle: "Make this workspace's forms public?",
      audiencePublicConfirmMessage: 'Anyone can submit every form that uses the workspace setting.',
      audienceInheritingForms: 'Forms using the workspace setting: {count}.',
      audiencePublicConfirmLabel: 'Make public',
      submitterSettingsDrawerLabel: 'Submitter Settings',
      allowSubmitterDraftsLabel: DRAFTS,
      allowSubmitterDraftsPublicNote: PUBLIC_NOTE,
      submitterSettingsLoadError: 'Could not load submitter settings.',
      formSettingsDrawerSaveSuccessMessage: 'Changes saved.',
      formSettingsDrawerSaveErrorMessage: 'Save failed.',
    },
  },
  workspaces: { formSettingsIntro: 'These settings are shared by every form in this workspace.' },
  modal: { dialogActions: 'Dialog actions' },
  general: {
    cancel: 'Cancel',
    noAccess: 'You do not have access to this.',
    sessionExpired: 'Your session has ended.',
  },
} as unknown as Dictionary;

const PROVIDERS = [
  { code: 'azureidir', name: 'IDIR - MFA' },
  { code: 'bceidbusiness', name: 'BCeID Business' },
];
const IDIR: Audience = { mode: 'protected', idps: ['azureidir'] };

let audience: Audience;
let submitter: SubmitterSettings;
let store: ReturnType<typeof makeStore>;

function renderTab() {
  return render(
    <Provider store={store}>
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
      >
        <WorkspaceFormSettings dict={mockDict} workspaceId="ws1" />
      </SWRConfig>
    </Provider>,
  );
}

const input = (testId: string) =>
  screen.getByTestId(testId).querySelector('input') as HTMLInputElement;
const radio = (mode: string) => input(`audience-mode-${mode}`);
const drafts = () => input('workspace-settings-allow-drafts');
const audienceSave = () => screen.getByTestId('form-settings-workspace-audience-save');
const submitterSave = () => screen.getByTestId('form-settings-workspace-submitter-save');

// A form's audience read, as a form drawer elsewhere in the app would hold it.
function FormAudienceProbe() {
  const { settings } = useFormSettings<{ effective: Audience }>('audience', 'f1');
  return <span data-testid="form-probe">{settings?.effective.mode ?? 'loading'}</span>;
}

function WithFormProbe() {
  const [shown, setShown] = React.useState(true);
  return (
    <>
      <button type="button" onClick={() => setShown((value) => !value)}>
        toggle form
      </button>
      {shown && <FormAudienceProbe />}
      <WorkspaceFormSettings dict={mockDict} workspaceId="ws1" />
    </>
  );
}

describe('WorkspaceFormSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    store.dispatch(setToken('token'));
    store.dispatch(setAuthenticated(true));
    audience = IDIR;
    submitter = { allowSubmitterDrafts: false };
    mockGetProviders.mockResolvedValue({ items: PROVIDERS });
    mockGetInheriting.mockResolvedValue({ count: 3 });
    mockGetSettings.mockImplementation((_token: string, _ws: string, key: string) =>
      Promise.resolve(key === 'audience' ? audience : submitter),
    );
    mockSetSettings.mockImplementation((_token: string, _ws: string, _key: string, body: unknown) =>
      Promise.resolve(body),
    );
  });

  it("shows the intro and the workspace's audience and drafts setting", async () => {
    renderTab();
    expect(screen.getByTestId('workspace-form-settings-intro')).toBeInTheDocument();
    await waitFor(() => expect(radio('protected')).toBeEnabled());

    expect(radio('protected')).toBeChecked();
    expect(input('audience-idp-azureidir')).toBeChecked();
    expect(drafts()).not.toBeChecked();
    expect(mockGetSettings).toHaveBeenCalledWith('token', 'ws1', 'audience');
    expect(mockGetSettings).toHaveBeenCalledWith('token', 'ws1', 'submitter');
  });

  it('saves the audience, and a Public audience notes that drafts are off without locking them', async () => {
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(radio('protected')).toBeEnabled());
    expect(screen.queryByTestId('workspace-settings-allow-drafts-public-note')).toBeNull();

    await user.click(screen.getByText('Public'));
    await user.click(audienceSave());
    await user.click(await screen.findByTestId('confirm-modal-confirm'));

    await waitFor(() =>
      expect(mockSetSettings).toHaveBeenCalledWith('token', 'ws1', 'audience', {
        mode: 'public',
        idps: [],
      }),
    );
    expect(
      await screen.findByTestId('workspace-settings-allow-drafts-public-note'),
    ).toHaveTextContent(PUBLIC_NOTE);
    expect(drafts()).toBeEnabled();
  });

  it('asks before making the workspace public, says how many forms it reaches, and saves nothing on cancel', async () => {
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(radio('protected')).toBeEnabled());

    await user.click(screen.getByText('Public'));
    await user.click(audienceSave());

    expect(await screen.findByTestId('confirm-modal-message')).toHaveTextContent(
      'Forms using the workspace setting: 3.',
    );
    expect(mockGetInheriting).toHaveBeenCalledWith('token', 'ws1', 'audience');
    await user.click(screen.getByTestId('confirm-modal-cancel'));

    await waitFor(() => expect(screen.queryByTestId('confirm-modal-message')).toBeNull());
    expect(mockSetSettings).not.toHaveBeenCalled();
    expect(radio('public')).toBeChecked();
  });

  // Only widening to Public reaches forms in a way worth stopping for.
  it('saves without asking when the workspace is already public', async () => {
    const user = userEvent.setup();
    audience = { mode: 'public', idps: [] };
    renderTab();
    await waitFor(() => expect(radio('public')).toBeEnabled());

    await user.click(audienceSave());

    await waitFor(() => expect(mockSetSettings).toHaveBeenCalled());
    expect(screen.queryByTestId('confirm-modal-message')).toBeNull();
    expect(mockGetInheriting).not.toHaveBeenCalled();
  });

  it('needs a login before a protected audience saves', async () => {
    const user = userEvent.setup();
    audience = { mode: 'members', idps: [] };
    renderTab();
    await waitFor(() => expect(radio('members')).toBeEnabled());

    await user.click(screen.getByText('Protected'));
    expect(screen.getByText(REQUIRED)).toBeInTheDocument();
    expect(audienceSave()).toBeDisabled();

    await user.click(screen.getByText('BCeID Business'));
    await user.click(audienceSave());
    await waitFor(() =>
      expect(mockSetSettings).toHaveBeenCalledWith('token', 'ws1', 'audience', {
        mode: 'protected',
        idps: ['bceidbusiness'],
      }),
    );
  });

  it('saves the drafts setting', async () => {
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(drafts()).toBeEnabled());

    await user.click(screen.getByText(DRAFTS));
    await user.click(submitterSave());

    await waitFor(() =>
      expect(mockSetSettings).toHaveBeenCalledWith('token', 'ws1', 'submitter', {
        allowSubmitterDrafts: true,
      }),
    );
    expect(drafts()).toBeChecked();
    expect(mockAddNotification).toHaveBeenCalledWith({ type: 'success', text: 'Changes saved.' });
  });

  it('keeps the edit and reports a failed save', async () => {
    const user = userEvent.setup();
    mockSetSettings.mockRejectedValue(new Error('boom'));
    renderTab();
    await waitFor(() => expect(drafts()).toBeEnabled());

    await user.click(screen.getByText(DRAFTS));
    await user.click(submitterSave());

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith({ type: 'error', text: 'Save failed.' }),
    );
    expect(drafts()).toBeChecked();
  });

  it('says when a group cannot be read and saves nothing', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockImplementation((_token: string, _ws: string, key: string) =>
      key === 'audience' ? Promise.reject(new ApiError('Boom', 500)) : Promise.resolve(submitter),
    );
    renderTab();

    expect(await screen.findByTestId('workspace-settings-audience-error')).toHaveTextContent(
      'Could not load the form audience.',
    );
    expect(audienceSave()).toBeDisabled();
    await user.click(audienceSave());
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  // The form view was read before the save and is not mounted when it happens.
  it('makes a form that inherits read its audience again after a workspace save', async () => {
    const user = userEvent.setup();
    mockGetForm
      .mockResolvedValueOnce({ effective: IDIR })
      .mockResolvedValue({ effective: { mode: 'public', idps: [] } });
    render(
      <Provider store={store}>
        <SWRConfig
          value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
        >
          <WithFormProbe />
        </SWRConfig>
      </Provider>,
    );
    expect(await screen.findByText('protected')).toBeInTheDocument();
    await user.click(screen.getByText('toggle form'));
    await waitFor(() => expect(radio('protected')).toBeEnabled());

    await user.click(screen.getByText('Public'));
    await user.click(audienceSave());
    await user.click(await screen.findByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(mockSetSettings).toHaveBeenCalled());
    await user.click(screen.getByText('toggle form'));

    expect(await screen.findByText('public')).toBeInTheDocument();
    expect(mockGetForm).toHaveBeenCalledTimes(2);
  });
});
