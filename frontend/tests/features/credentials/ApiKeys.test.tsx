import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/dictionaries/en.json';
import fr from '@/dictionaries/fr.json';
import ApiKeys from '@/src/features/credentials/ui/ApiKeys';
import type { CredentialMetadata } from '@/src/types/credentials';
vi.mock('next/navigation', () => ({
  usePathname: () => '/en/workspaces/workspace',
  useSearchParams: () => new URLSearchParams(),
}));
const mocks = vi.hoisted(() => ({
  locale: 'en',
  readScope: vi.fn(),
  writeScope: vi.fn(),
  resource: {
    data: undefined as unknown,
    error: undefined as unknown,
    isLoading: false,
    generate: vi.fn(),
    refresh: vi.fn(),
  },
  auth: { authenticated: true, idTokenParsed: { sub: 'user' } },
}));
vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => (mocks.locale === 'fr' ? fr : en),
}));
vi.mock('@/lib/hooks/useKeycloak', () => ({ useKeycloak: () => mocks.auth }));
vi.mock('@/src/features/credentials/data/useCredentials', () => ({
  useCredentials: (scope: unknown) => {
    mocks.readScope(scope);
    return mocks.resource;
  },
  useCredentialWriter: (scope: unknown) => {
    mocks.writeScope(scope);
    return { generate: mocks.resource.generate };
  },
}));
const credential: CredentialMetadata = {
  id: 'credential',
  label: 'Integration',
  notes: 'Vault',
  types: ['api', 'web-component'],
  status: 'active',
  createdAt: '2026-10-09T15:53:52Z',
  updatedAt: '2026-10-09T15:53:52Z',
  rotatedAt: null,
};
const key = 'only-visible-in-dialog';
const renderSection = () => render(<ApiKeys scope={{ kind: 'workspace', id: 'workspace' }} />);
const label = () => screen.getByTestId('api-key-label').querySelector('input')!;
const notes = () => screen.getByTestId('api-key-notes').querySelector('input')!;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = 'en';
  mocks.auth.authenticated = true;
  mocks.auth.idTokenParsed.sub = 'user';
  mocks.resource.data = { available: true, items: [], page: { offset: 0, limit: 10, total: 0 } };
  mocks.resource.error = undefined;
  mocks.resource.isLoading = false;
  mocks.resource.generate.mockResolvedValue({ credential, apiKey: key });
  mocks.resource.refresh.mockResolvedValue(undefined);
});
async function fill() {
  const user = userEvent.setup();
  await user.click(screen.getByTestId('api-key-add'));
  await user.type(label(), 'Integration');
  await user.type(notes(), 'Vault');
  await user.click(screen.getByText(en.apiKeys.apiAccess));
  await user.click(screen.getByText(en.apiKeys.webComponents));
  return user;
}
describe('workspace and form API keys', () => {
  it('creates form keys through the form reader and writer', async () => {
    render(<ApiKeys scope={{ kind: 'form', id: 'form' }} />);
    const user = await fill();
    await user.click(screen.getByTestId('api-key-generate'));
    expect(await screen.findByDisplayValue(key)).toBeInTheDocument();
    expect(mocks.readScope).toHaveBeenCalledWith({ kind: 'form', id: 'form' });
    expect(mocks.writeScope).toHaveBeenCalledWith({ kind: 'form', id: 'form' });
    expect(mocks.resource.generate).toHaveBeenCalledWith({
      label: 'Integration',
      notes: 'Vault',
      types: ['api', 'web-component'],
    });
  });

  it.each(['issuing', 'rotating', 'unknown'] as const)(
    'allows refreshing a successful read containing a %s credential',
    async (status) => {
      mocks.resource.data = {
        available: true,
        items: [{ ...credential, status }],
        page: { offset: 0, limit: 10, total: 1 },
      };
      renderSection();
      await userEvent.setup().click(screen.getByRole('button', { name: en.apiKeys.refresh }));
      expect(mocks.resource.refresh).toHaveBeenCalledTimes(1);
      expect(mocks.resource.generate).not.toHaveBeenCalled();
    },
  );
  it('lists multiple keys and their types with no editing or rotation actions', () => {
    mocks.resource.data = {
      available: true,
      page: { offset: 0, limit: 10, total: 2 },
      items: [credential, { ...credential, id: 'second', label: 'Second' }],
    };
    renderSection();
    expect(screen.getByText('Integration')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getAllByText('API, Web Component')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /regenerate/i })).toBeNull();
  });
  it('requires a label and at least one type, and cancels without issuing', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByTestId('api-key-add'));
    expect(screen.getByTestId('api-key-generate')).toBeDisabled();
    await user.type(label(), 'Integration');
    expect(screen.getByTestId('api-key-generate')).toBeDisabled();
    await user.click(screen.getByTestId('api-key-cancel'));
    expect(mocks.resource.generate).not.toHaveBeenCalled();
  });
  it('creates with both types and shows the secret only until the dialog closes', async () => {
    renderSection();
    const user = await fill();
    await user.click(screen.getByTestId('api-key-generate'));
    expect(mocks.resource.generate).toHaveBeenCalledWith({
      label: 'Integration',
      notes: 'Vault',
      types: ['api', 'web-component'],
    });
    expect(await screen.findByDisplayValue(key)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: en.apiKeys.copy }));
    expect(await navigator.clipboard.readText()).toBe(key);
    await user.click(screen.getByRole('button', { name: en.apiKeys.done }));
    expect(screen.queryByDisplayValue(key)).toBeNull();
    expect(screen.getByTestId('api-key-add')).toBeEnabled();
  });
  it('disables fields and cancellation during issuance and prevents double submission', async () => {
    let resolve!: (value: { credential: CredentialMetadata; apiKey: string }) => void;
    mocks.resource.generate.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderSection();
    const user = await fill();
    await user.dblClick(screen.getByTestId('api-key-generate'));
    expect(mocks.resource.generate).toHaveBeenCalledTimes(1);
    expect(label()).toBeDisabled();
    expect(screen.getByTestId('api-key-cancel')).toBeDisabled();
    await act(async () => resolve({ credential, apiKey: key }));
    expect(await screen.findByDisplayValue(key)).toBeInTheDocument();
  });
  it('keeps input when issuance fails', async () => {
    mocks.resource.generate.mockRejectedValue(new Error('issuer failure'));
    renderSection();
    const user = await fill();
    await user.click(screen.getByTestId('api-key-generate'));
    expect(await screen.findByText(en.apiKeys.actionError)).toBeInTheDocument();
    expect(label()).toHaveValue('Integration');
  });
  it('clears the secret when workspace or session changes', async () => {
    const view = renderSection();
    const user = await fill();
    await user.click(screen.getByTestId('api-key-generate'));
    await screen.findByDisplayValue(key);
    view.rerender(<ApiKeys scope={{ kind: 'workspace', id: 'other' }} />);
    expect(screen.queryByDisplayValue(key)).toBeNull();
    mocks.auth.authenticated = false;
    view.rerender(<ApiKeys scope={{ kind: 'workspace', id: 'other' }} />);
    expect(screen.queryByTestId('api-key-add')).toBeNull();
  });
  it('shows load errors and disables creation', () => {
    mocks.resource.error = { kind: 'failed', cause: new Error('failed') };
    renderSection();
    expect(screen.getByText(en.apiKeys.loadError)).toBeInTheDocument();
    expect(screen.getByTestId('api-key-add')).toBeDisabled();
  });
  it('renders the create form in French', async () => {
    mocks.locale = 'fr';
    renderSection();
    await userEvent.setup().click(screen.getByRole('button', { name: fr.apiKeys.add }));
    await waitFor(() => expect(screen.getByText(fr.apiKeys.typesHelp)).toBeInTheDocument());
  });
});
