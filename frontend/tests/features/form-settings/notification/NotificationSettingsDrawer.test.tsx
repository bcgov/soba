import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationSettingsDrawer from '@/src/features/form-settings/notification/NotificationSettingsDrawer';
import dict from '@/dictionaries/en.json';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  addNotification: vi.fn(),
  settings: { values: { recipients: ['staff@example.com'] }, version: 3 },
}));
vi.mock('@/lib/hooks/useKeycloak', () => ({ useKeycloak: () => ({ token: 'token' }) }));
vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification: mocks.addNotification }),
}));
vi.mock('@/src/features/form-settings/data/useFormSettings', () => ({
  useFormSettings: () => ({ settings: mocks.settings, error: null, save: mocks.save }),
}));
vi.mock('@/src/features/form-settings/ui/FormSettingsDrawers', () => ({
  default: ({
    children,
    onSave,
    onCancel,
    canSave,
  }: {
    children: React.ReactNode;
    onSave: () => void;
    onCancel: () => void;
    canSave: boolean;
  }) => (
    <div>
      {children}
      <button disabled={!canSave} onClick={onSave}>
        Save
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));
const renderDrawer = () =>
  render(<NotificationSettingsDrawer dict={dict} drawerName="notification" formId="f1" />);
describe('notification settings editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('shows stored recipients and waits for edits', () => {
    renderDrawer();
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByText('staff@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
  it('saves normalized recipients with the loaded version', async () => {
    renderDrawer();
    const user = userEvent.setup();
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'A@example.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByRole('textbox'), 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mocks.save).toHaveBeenCalledWith('token', {
      values: { recipients: ['staff@example.com', 'a@example.com'] },
      version: 3,
    });
  });
  it('blocks invalid addresses and cancel restores the saved list', async () => {
    renderDrawer();
    const user = userEvent.setup();
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'invalid');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await user.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByText('staff@example.com')).toBeInTheDocument();
  });
  it('allows clearing recipients to disable notifications', async () => {
    renderDrawer();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Remove staff@example\.com/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mocks.save).toHaveBeenCalledWith('token', { values: { recipients: [] }, version: 3 });
  });
});
