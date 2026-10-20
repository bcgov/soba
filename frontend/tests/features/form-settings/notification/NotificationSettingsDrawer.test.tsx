import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';
import dict from '@/dictionaries/en.json';
import type { FormNotificationSettings } from '@/src/types/formSettings';
import { ApiError } from '@/src/shared/api/sobaHelpers';

const { mockGetSettings, mockSetSettings, mockAddNotification } = vi.hoisted(() => ({
  mockGetSettings: vi.fn(),
  mockSetSettings: vi.fn(),
  mockAddNotification: vi.fn(),
}));

vi.mock('@/src/features/form-settings/data/api', () => ({
  getFormSettings: mockGetSettings,
  setFormSettings: mockSetSettings,
}));

vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification: mockAddNotification }),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import NotificationSettingsDrawer from '@/src/features/form-settings/notification/NotificationSettingsDrawer';

const t = dict.form.settings;

const stored = (recipients: string[], version = 3): FormNotificationSettings => ({
  values: { recipients },
  version,
});

let store: ReturnType<typeof makeStore>;

function renderDrawer() {
  return render(
    <Provider store={store}>
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
      >
        <NotificationSettingsDrawer dict={dict} drawerName="notification-settings" formId="f1" />
      </SWRConfig>
    </Provider>,
  );
}

// The drawer's accordion starts collapsed, so its content is in the DOM but hidden from role queries.
const input = () =>
  screen
    .getByTestId('form-settings-notification-recipient-input')
    .querySelector('input') as HTMLInputElement;
const addButton = () => screen.getByTestId('form-settings-notification-recipient-add');
const saveButton = () => screen.getByTestId('form-settings-notification-settings-save');
const cancelButton = () => screen.getByTestId('form-settings-notification-settings-cancel');
const recipientList = () => screen.getByTestId('form-settings-notification-recipients');
const removeButton = (address: string) =>
  within(recipientList()).getByRole('button', {
    hidden: true,
    name: new RegExp(address.replace('.', String.raw`\.`)),
  });

async function loaded(recipients: string[]) {
  mockGetSettings.mockResolvedValue(stored(recipients));
  renderDrawer();
  await waitFor(() => expect(input()).toBeEnabled());
}

describe('NotificationSettingsDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    store.dispatch(setToken('token'));
    store.dispatch(setAuthenticated(true));
  });

  it('shows the stored recipients and keeps Save off until something changes', async () => {
    await loaded(['staff@example.com']);
    expect(within(recipientList()).getByText('staff@example.com')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(mockGetSettings).toHaveBeenCalledWith('token', 'f1', 'notification');
  });

  it('adds a normalized address and saves the list with the version it read', async () => {
    const user = userEvent.setup();
    await loaded(['staff@example.com']);
    mockSetSettings.mockResolvedValue(stored(['staff@example.com', 'a@example.com'], 4));

    await user.type(input(), ' A@Example.com ');
    await user.click(addButton());
    expect(input()).toHaveValue('');
    expect(input()).toHaveFocus();
    expect(within(recipientList()).getByText('a@example.com')).toBeInTheDocument();
    await user.click(saveButton());

    await waitFor(() =>
      expect(mockSetSettings).toHaveBeenCalledWith('token', 'f1', 'notification', {
        values: { recipients: ['staff@example.com', 'a@example.com'] },
        version: 3,
      }),
    );
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(mockAddNotification).toHaveBeenCalledWith({
      type: 'success',
      text: t.formSettingsDrawerSaveSuccessMessage,
    });
    expect(screen.getAllByTestId('form-settings-notification-recipient')).toHaveLength(2);
  });

  it('adds with Enter, and an address already listed changes nothing', async () => {
    const user = userEvent.setup();
    await loaded(['staff@example.com']);

    await user.type(input(), 'Staff@example.com{Enter}');
    expect(input()).toHaveValue('');
    expect(within(recipientList()).getAllByText('staff@example.com')).toHaveLength(1);
    expect(saveButton()).toBeDisabled();
  });

  it('saves an address left in the field without Add', async () => {
    const user = userEvent.setup();
    await loaded([]);
    mockSetSettings.mockResolvedValue(stored(['b@example.com'], 4));

    await user.type(input(), 'b@example.com');
    await user.click(saveButton());

    await waitFor(() =>
      expect(mockSetSettings).toHaveBeenCalledWith('token', 'f1', 'notification', {
        values: { recipients: ['b@example.com'] },
        version: 3,
      }),
    );
  });

  it('reports an invalid address only when it is added, and never saves it', async () => {
    const user = userEvent.setup();
    await loaded([]);

    await user.type(input(), 'not-an-address');
    expect(screen.queryByText(t.notificationRecipientsInvalid)).not.toBeInTheDocument();
    await user.click(addButton());
    expect(screen.getByText(t.notificationRecipientsInvalid)).toBeInTheDocument();
    expect(input()).toHaveFocus();
    await user.click(saveButton());
    expect(mockSetSettings).not.toHaveBeenCalled();

    await user.type(input(), 'x');
    expect(screen.queryByText(t.notificationRecipientsInvalid)).not.toBeInTheDocument();
  });

  it('reports an invalid address on Save alone', async () => {
    const user = userEvent.setup();
    await loaded([]);

    await user.type(input(), 'not-an-address');
    await user.click(saveButton());
    expect(screen.getByText(t.notificationRecipientsInvalid)).toBeInTheDocument();
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  it('refuses a recipient past the limit, and a removal clears the message and saves', async () => {
    const user = userEvent.setup();
    const full = Array.from({ length: 100 }, (_, i) => `staff${i}@example.com`);
    await loaded(full);
    mockSetSettings.mockResolvedValue(stored(full.slice(1), 4));

    await user.type(input(), 'one-more@example.com');
    await user.click(addButton());
    expect(screen.getByText(t.notificationRecipientsLimit)).toBeInTheDocument();

    await user.click(removeButton('staff0@example.com'));
    expect(screen.queryByText(t.notificationRecipientsLimit)).not.toBeInTheDocument();
    await user.click(saveButton());
    await waitFor(() =>
      expect(mockSetSettings).toHaveBeenCalledWith('token', 'f1', 'notification', {
        values: { recipients: [...full.slice(1), 'one-more@example.com'] },
        version: 3,
      }),
    );
  });

  it('a listed address left in the field saves nothing and clears the field', async () => {
    const user = userEvent.setup();
    await loaded(['staff@example.com']);

    await user.type(input(), 'staff@example.com');
    await user.click(saveButton());
    expect(input()).toHaveValue('');
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  it('saves an empty list to turn notifications off', async () => {
    const user = userEvent.setup();
    await loaded(['staff@example.com']);
    mockSetSettings.mockResolvedValue(stored([], 4));

    await user.click(removeButton('staff@example.com'));
    expect(screen.getByText(t.notificationRecipientsEmpty)).toBeInTheDocument();
    await user.click(saveButton());

    await waitFor(() =>
      expect(mockSetSettings).toHaveBeenCalledWith('token', 'f1', 'notification', {
        values: { recipients: [] },
        version: 3,
      }),
    );
  });

  it('Cancel restores the stored list and clears the field', async () => {
    const user = userEvent.setup();
    await loaded(['staff@example.com']);

    await user.click(removeButton('staff@example.com'));
    await user.type(input(), 'c@example.com');
    await user.click(cancelButton());

    expect(within(recipientList()).getByText('staff@example.com')).toBeInTheDocument();
    expect(input()).toHaveValue('');
    expect(saveButton()).toBeDisabled();
  });

  it('drops the edit and shows the newer list when someone else saved first', async () => {
    const user = userEvent.setup();
    await loaded(['staff@example.com']);
    mockSetSettings.mockRejectedValue(new ApiError('Conflict', 409));
    mockGetSettings.mockResolvedValue(stored(['other@example.com'], 4));

    await user.type(input(), 'd@example.com');
    await user.click(saveButton());

    await waitFor(() =>
      expect(within(recipientList()).getByText('other@example.com')).toBeInTheDocument(),
    );
    expect(within(recipientList()).queryByText('d@example.com')).not.toBeInTheDocument();
    expect(mockAddNotification).toHaveBeenCalledWith({
      type: 'error',
      text: t.settingsConflictMessage,
    });
  });

  it('keeps the edit after a failed save so it can be retried', async () => {
    const user = userEvent.setup();
    await loaded([]);
    mockSetSettings.mockRejectedValue(new ApiError('Boom', 500));

    await user.type(input(), 'e@example.com');
    await user.click(saveButton());

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'error',
        text: t.formSettingsDrawerSaveErrorMessage,
      }),
    );
    expect(within(recipientList()).getByText('e@example.com')).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('shows a load failure and stays read-only', async () => {
    mockGetSettings.mockRejectedValue(new ApiError('Boom', 500));
    renderDrawer();
    expect(await screen.findByTestId('form-settings-notification-error')).toBeInTheDocument();
    expect(input()).toBeDisabled();
    expect(saveButton()).toBeDisabled();
  });
});
