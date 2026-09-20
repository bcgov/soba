import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { SWRConfig, useSWRConfig } from 'swr';
import type { Dictionary } from '@/src/types/dictionary';
import type { FormSubmitterAudience } from '@/src/types/groups';
import { ApiError } from '@/src/shared/api/sobaHelpers';

const { mockGetSettings, mockSetSettings, mockGetAudience, mockAddNotification, mockGetForm } =
  vi.hoisted(() => ({
    mockGetSettings: vi.fn(),
    mockSetSettings: vi.fn(),
    mockGetAudience: vi.fn(),
    mockAddNotification: vi.fn(),
    mockGetForm: vi.fn(),
  }));

vi.mock('@/src/shared/api/sobaApi', () => ({
  getSobaForm: mockGetForm,
  getSobaFormVersion: vi.fn(),
  lookupFormVersions: vi.fn().mockResolvedValue({ items: [] }),
  getFormVersionSchema: vi.fn(),
}));

vi.mock('@/src/features/form-settings/api', () => ({
  getFormSettings: mockGetSettings,
  setFormSettings: mockSetSettings,
}));

vi.mock('@/src/shared/api/sobaApiGroups', () => ({
  getFormSubmitterAudience: mockGetAudience,
  setFormSubmitterAudience: vi.fn(),
  getSubmitterAudience: vi.fn(),
  setSubmitterAudience: vi.fn(),
}));

vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification: mockAddNotification }),
}));

// The audience control reads the dictionary from context and has its own suite.
vi.mock('@/src/features/designer/ui/FormSubmitterAudience', () => ({
  FormSubmitterAudience: ({ canManage }: { canManage: boolean }) => (
    <div data-testid="submitter-audience" data-can-manage={String(canManage)} />
  ),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import SubmitterSettingsDrawer from '@/src/features/form-settings/submitter/SubmitterSettingsDrawer';

const LABEL = 'Allow Submitters to Save and Edit Drafts';
const PUBLIC_NOTE = 'Drafts are not available for Public forms.';

const mockDict = {
  form: {
    save: 'Save',
    settings: {
      submitterSettingsDrawerLabel: 'Submitter Settings',
      allowSubmitterDraftsLabel: LABEL,
      allowSubmitterDraftsPublicNote: PUBLIC_NOTE,
      submitterSettingsLoadError: 'load error',
      formSettingsDrawerSaveSuccessMessage: 'Changes saved.',
      formSettingsDrawerSaveErrorMessage: 'Save failed.',
    },
  },
  general: {
    cancel: 'Cancel',
    noAccess: 'You do not have access to this.',
    sessionExpired: 'Your session has ended.',
  },
} as unknown as Dictionary;

// The form's effective audience, as the form endpoint returns it while the form inherits.
const audience = (mode: FormSubmitterAudience['mode']): FormSubmitterAudience => ({
  inherit: true,
  mode,
  idps: [],
  available: [],
  workspace: { mode, idps: [], users: [] },
});

let store: ReturnType<typeof makeStore>;

// Stands in for a later read that finds the audience has become Public.
function MakeAudiencePublic() {
  const { mutate } = useSWRConfig();
  return (
    <button
      type="button"
      data-testid="make-audience-public"
      onClick={() =>
        mutate(['form-submitter-audience', 'f1'], audience('public'), { revalidate: false })
      }
    >
      make public
    </button>
  );
}

function renderDrawer() {
  return render(
    <Provider store={store}>
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
      >
        <MakeAudiencePublic />
        <SubmitterSettingsDrawer dict={mockDict} drawerName="submitter-settings" formId="f1" />
      </SWRConfig>
    </Provider>,
  );
}

const checkbox = () =>
  screen.getByTestId('form-settings-allow-drafts').querySelector('input') as HTMLInputElement;
const saveButton = () => screen.getByTestId('form-settings-submitter-settings-save');

describe('SubmitterSettingsDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    store.dispatch(setToken('token'));
    store.dispatch(setAuthenticated(true));
    mockGetAudience.mockResolvedValue(audience('protected'));
    mockGetForm.mockResolvedValue({ id: 'f1', workspaceId: 'ws1', permissions: ['form_update'] });
  });

  // The audience is the form's, so editing it follows form_update rather than a workspace role.
  it.each([
    [['form_update'], 'true'],
    [['*'], 'true'],
    [['form_read'], 'false'],
  ])('gates the audience control on %s', async (permissions, canManage) => {
    mockGetSettings.mockResolvedValue({ allowSubmitterDrafts: false });
    mockGetForm.mockResolvedValue({ id: 'f1', workspaceId: 'ws1', permissions });
    renderDrawer();
    await waitFor(() =>
      expect(screen.getByTestId('submitter-audience')).toHaveAttribute(
        'data-can-manage',
        canManage,
      ),
    );
  });

  it('shows the saved setting', async () => {
    mockGetSettings.mockResolvedValue({ allowSubmitterDrafts: true });
    renderDrawer();
    await waitFor(() => expect(checkbox()).toBeEnabled());
    expect(checkbox()).toBeChecked();
    expect(mockGetSettings).toHaveBeenCalledWith('token', 'f1', 'submitter');
  });

  it('saves the changed setting', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue({ allowSubmitterDrafts: false });
    mockSetSettings.mockResolvedValue({ allowSubmitterDrafts: true });
    renderDrawer();
    await waitFor(() => expect(checkbox()).toBeEnabled());

    await user.click(screen.getByText(LABEL));
    await user.click(saveButton());

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith({ type: 'success', text: 'Changes saved.' }),
    );
    expect(mockSetSettings).toHaveBeenCalledWith('token', 'f1', 'submitter', {
      allowSubmitterDrafts: true,
    });
    expect(checkbox()).toBeChecked();
  });

  it('keeps the edit and reports a failed save', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue({ allowSubmitterDrafts: false });
    mockSetSettings.mockRejectedValue(new Error('boom'));
    renderDrawer();
    await waitFor(() => expect(checkbox()).toBeEnabled());

    await user.click(screen.getByText(LABEL));
    await user.click(saveButton());

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith({ type: 'error', text: 'Save failed.' }),
    );
    expect(checkbox()).toBeChecked();
  });

  it('sends one save when Save is pressed twice', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue({ allowSubmitterDrafts: false });
    mockSetSettings.mockImplementation(() => new Promise(() => {}));
    renderDrawer();
    await waitFor(() => expect(checkbox()).toBeEnabled());

    await user.click(screen.getByText(LABEL));
    await user.click(saveButton());
    await user.click(saveButton());

    expect(mockSetSettings).toHaveBeenCalledTimes(1);
  });

  it('cancels an unsaved change', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue({ allowSubmitterDrafts: false });
    renderDrawer();
    await waitFor(() => expect(checkbox()).toBeEnabled());

    await user.click(screen.getByText(LABEL));
    expect(checkbox()).toBeChecked();
    await user.click(screen.getByTestId('form-settings-submitter-settings-cancel'));

    expect(checkbox()).not.toBeChecked();
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  // Whether the audience is Public decides if the setting may change, so it stays locked until known.
  it('keeps the setting locked until the audience is known', async () => {
    mockGetSettings.mockResolvedValue({ allowSubmitterDrafts: true });
    mockGetAudience.mockImplementation(() => new Promise(() => {}));
    renderDrawer();

    await waitFor(() => expect(checkbox()).toBeChecked());
    expect(checkbox()).toBeDisabled();
  });

  it('disables the setting with a linked note on a Public audience', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue({ allowSubmitterDrafts: true });
    mockGetAudience.mockResolvedValue(audience('public'));
    renderDrawer();

    await waitFor(() => expect(checkbox()).toBeChecked());
    expect(await screen.findByTestId('form-settings-allow-drafts-public-note')).toHaveTextContent(
      PUBLIC_NOTE,
    );
    expect(checkbox()).toBeDisabled();
    const describedBy = screen
      .getByTestId('form-settings-allow-drafts')
      .querySelector('[aria-describedby]')
      ?.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy ?? '')).toHaveTextContent(PUBLIC_NOTE);

    await user.click(saveButton());
    expect(mockSetSettings).not.toHaveBeenCalled();
    expect(mockGetAudience).toHaveBeenCalledWith('token', 'f1');
  });

  it('drops an edit when the audience turns out to be Public', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue({ allowSubmitterDrafts: false });
    renderDrawer();
    await waitFor(() => expect(checkbox()).toBeEnabled());

    await user.click(screen.getByText(LABEL));
    expect(checkbox()).toBeChecked();

    await user.click(screen.getByTestId('make-audience-public'));

    await waitFor(() => expect(checkbox()).not.toBeChecked());
    expect(checkbox()).toBeDisabled();
    await user.click(saveButton());
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  it('says when the settings cannot be read and saves nothing', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockRejectedValue(new ApiError('Boom', 500));
    renderDrawer();

    expect(await screen.findByTestId('form-settings-submitter-settings-error')).toHaveTextContent(
      'load error',
    );
    expect(checkbox()).toBeDisabled();
    await user.click(saveButton());
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  // Without the audience the Public lock cannot be judged, so a refused read keeps the setting locked.
  it('says when the audience cannot be read and stays locked', async () => {
    mockGetSettings.mockResolvedValue({ allowSubmitterDrafts: false });
    mockGetAudience.mockRejectedValue(new ApiError('Forbidden', 403));
    renderDrawer();

    expect(await screen.findByTestId('form-settings-submitter-settings-error')).toHaveTextContent(
      'You do not have access to this.',
    );
    expect(checkbox()).toBeDisabled();
  });
});
