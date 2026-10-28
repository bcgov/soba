import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/dictionaries/en.json';
import fr from '@/dictionaries/fr.json';
import WorkspaceApiKey from '@/src/features/credentials/ui/WorkspaceApiKey';
import type { CredentialMetadata } from '@/src/features/credentials/data/api';

const mocks = vi.hoisted(() => ({
  locale: 'en' as 'en' | 'fr',
  resource: {
    data: undefined as unknown,
    error: undefined as unknown,
    isLoading: false,
    generate: vi.fn(),
    saveNotes: vi.fn(),
    refresh: vi.fn(),
  },
  auth: { authenticated: true, idTokenParsed: { sub: 'user' } },
}));
vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => (mocks.locale === 'fr' ? fr : en),
}));
vi.mock('@/lib/hooks/useKeycloak', () => ({ useKeycloak: () => mocks.auth }));
vi.mock('@/src/features/credentials/data/useCredential', () => ({
  useCredential: () => mocks.resource,
}));
const credential: CredentialMetadata = {
  id: 'credential',
  label: 'CREDENTIAL-LABEL',
  notes: '',
  status: 'active',
  createdAt: '2026-10-09T15:53:52Z',
  updatedAt: '2026-10-09T15:53:52Z',
  rotatedAt: null,
};
const key = 'only-visible-in-dialog';
const renderSection = () =>
  render(
    <WorkspaceApiKey
      workspaceId="workspace"
      helpUrl="https://example.test/help"
      revokeUrl="https://example.test/revoke"
    />,
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = 'en';
  mocks.auth.authenticated = true;
  mocks.resource.data = { available: true, credential: null };
  mocks.resource.error = undefined;
  mocks.resource.isLoading = false;
  mocks.resource.generate.mockResolvedValue({ credential, apiKey: key });
  mocks.resource.saveNotes.mockResolvedValue(undefined);
});

describe('workspace API key', () => {
  it('renders the French metadata, confirmation, key dialog, and save error', async () => {
    mocks.locale = 'fr';
    mocks.resource.data = { available: true, credential };
    mocks.resource.saveNotes.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    renderSection();
    expect(
      screen.getByRole('heading', { name: `${fr.apiKeys.heading} ${fr.apiKeys.info}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: fr.apiKeys.learn })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: fr.apiKeys.revoke })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: fr.apiKeys.label })).toBeInTheDocument();
    const date = new Date(credential.createdAt);
    const created = fr.apiKeys.created
      .replace('{date}', new Intl.DateTimeFormat('fr', { dateStyle: 'medium' }).format(date))
      .replace('{time}', new Intl.DateTimeFormat('fr', { timeStyle: 'medium' }).format(date));
    expect(screen.getByText(created)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: fr.apiKeys.regenerate }));
    expect(screen.getByText(fr.apiKeys.confirmBody)).toBeInTheDocument();
    await user.click(screen.getByTestId('confirm-modal-confirm'));
    expect(await screen.findByLabelText(fr.apiKeys.yourKey)).toHaveValue(key);
    expect(screen.getByText(fr.apiKeys.onceTitle)).toBeInTheDocument();
    expect(screen.getByText(fr.apiKeys.onceBody)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(fr.apiKeys.notesPlaceholder)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: fr.apiKeys.copy }));
    expect(await screen.findByText(fr.apiKeys.copied)).toBeInTheDocument();
    await user.type(screen.getByLabelText(fr.apiKeys.notes), 'Coffre-fort');
    await user.click(screen.getByRole('button', { name: fr.apiKeys.done }));
    expect(await screen.findByText(fr.apiKeys.saveError)).toBeInTheDocument();
  });

  it('generates a key, copies it, and removes it from the DOM on Done', async () => {
    const user = userEvent.setup();
    renderSection();
    expect(screen.getByRole('link', { name: en.apiKeys.learn })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(screen.getByRole('link', { name: en.apiKeys.revoke })).toHaveAttribute(
      'href',
      'https://example.test/revoke',
    );
    await user.click(screen.getByRole('button', { name: en.apiKeys.generate }));
    expect(mocks.resource.generate).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText(en.apiKeys.yourKey)).toHaveValue(key);
    expect(screen.getByText(en.apiKeys.onceTitle)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: en.apiKeys.copy }));
    expect(await navigator.clipboard.readText()).toBe(key);
    await user.click(screen.getByRole('button', { name: en.apiKeys.done }));
    await waitFor(() => expect(screen.queryByDisplayValue(key)).not.toBeInTheDocument());
    expect(mocks.resource.saveNotes).not.toHaveBeenCalled();
  });
  it('persists notes on Done without sending the secret', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole('button', { name: en.apiKeys.generate }));
    await user.type(await screen.findByLabelText(en.apiKeys.notes), 'Stored in our vault');
    await user.click(screen.getByRole('button', { name: en.apiKeys.done }));
    await waitFor(() =>
      expect(mocks.resource.saveNotes).toHaveBeenCalledWith('credential', 'Stored in our vault'),
    );
    expect(screen.queryByDisplayValue(key)).not.toBeInTheDocument();
  });
  it('keeps the key visible if saving notes fails', async () => {
    mocks.resource.saveNotes.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole('button', { name: en.apiKeys.generate }));
    await user.type(await screen.findByLabelText(en.apiKeys.notes), 'A note');
    await user.click(screen.getByRole('button', { name: en.apiKeys.done }));
    expect(await screen.findByText(en.apiKeys.saveError)).toBeInTheDocument();
    expect(screen.getByLabelText(en.apiKeys.yourKey)).toHaveValue(key);
  });
  it('discards the secret and unsaved notes when dismissed', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole('button', { name: en.apiKeys.generate }));
    await screen.findByLabelText(en.apiKeys.yourKey);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByDisplayValue(key)).not.toBeInTheDocument());
    expect(mocks.resource.saveNotes).not.toHaveBeenCalled();
  });
  it('requires confirmation before regenerating an existing key', async () => {
    mocks.resource.data = {
      available: true,
      credential: { ...credential, notes: 'Stored safely' },
    };
    const user = userEvent.setup();
    renderSection();
    expect(screen.getByText(credential.label)).toBeInTheDocument();
    expect(screen.getByText('Stored safely')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: en.apiKeys.regenerate }));
    expect(mocks.resource.generate).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('confirm-modal-confirm'));
    expect(await screen.findByLabelText(en.apiKeys.yourKey)).toHaveValue(key);
    expect(mocks.resource.generate).toHaveBeenCalledTimes(1);
  });
  it('blocks unknown outcomes and unavailable issuers', () => {
    mocks.resource.data = { available: true, credential: { ...credential, status: 'unknown' } };
    const { rerender } = renderSection();
    expect(screen.getByRole('button', { name: en.apiKeys.regenerate })).toBeDisabled();
    expect(screen.getByText(en.apiKeys.pending)).toBeInTheDocument();
    mocks.resource.data = { available: false, credential: null };
    rerender(<WorkspaceApiKey workspaceId="workspace" />);
    expect(screen.getByRole('button', { name: en.apiKeys.generate })).toBeDisabled();
  });
  it('clears a displayed key when the authenticated session ends', async () => {
    const user = userEvent.setup();
    const { rerender } = renderSection();
    await user.click(screen.getByRole('button', { name: en.apiKeys.generate }));
    await screen.findByLabelText(en.apiKeys.yourKey);
    mocks.auth.authenticated = false;
    await act(async () => rerender(<WorkspaceApiKey workspaceId="workspace" />));
    expect(screen.queryByDisplayValue(key)).not.toBeInTheDocument();
  });
});
