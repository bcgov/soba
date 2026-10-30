import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/dictionaries/en.json';
import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import ApiKeys from '@/src/features/credentials/ui/ApiKeys';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { SessionExpiredError } from '@/src/shared/api/sobaFetch';
import type { CredentialMetadata, CredentialState } from '@/src/types/credentials';

const api = vi.hoisted(() => ({ listCredentials: vi.fn(), issueCredential: vi.fn() }));
vi.mock('@/src/features/credentials/data/api', () => api);
vi.mock('@/app/[lang]/Providers', () => ({ useDictionary: () => en }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/en/workspaces/workspace',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const credential: CredentialMetadata = {
  id: '01900000-0000-7000-8000-000000000001',
  label: 'Integration',
  notes: '',
  types: ['api'],
  status: 'active',
  createdAt: '2026-10-30T00:00:00Z',
  updatedAt: '2026-10-30T00:00:00Z',
  rotatedAt: null,
};
const state = (items: CredentialMetadata[] = [], total = items.length): CredentialState => ({
  available: true,
  items,
  page: { offset: 0, limit: 10, total },
  filters: {},
  sort: 'createdAt:desc',
});

function renderKeys() {
  const store = makeStore();
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
  const cache = new Map();
  const content = () => (
    <Provider store={store}>
      <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false }}>
        <ApiKeys scope={{ kind: 'workspace', id: 'workspace' }} />
      </SWRConfig>
    </Provider>
  );
  const view = render(content());
  return { ...view, cache, reload: () => view.rerender(content()) };
}

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, '', '/en/workspaces/workspace');
  api.listCredentials.mockResolvedValue(state());
});

describe('API keys with the store and SWR', () => {
  it('loads metadata and re-reads the list after creation, caching no secret', async () => {
    let resolve!: (value: CredentialState) => void;
    api.listCredentials.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { cache } = renderKeys();
    expect(screen.getByTestId('api-key-add')).toBeDisabled();
    await act(async () => resolve(state()));
    const user = userEvent.setup();
    await user.click(screen.getByTestId('api-key-add'));
    await user.type(screen.getByTestId('api-key-label').querySelector('input')!, 'Integration');
    await user.click(screen.getByTestId('api-key-type-api'));
    api.issueCredential.mockResolvedValue({ credential, apiKey: 'one-time-secret' });
    api.listCredentials.mockResolvedValue(state([credential]));
    await user.click(screen.getByTestId('api-key-generate'));
    expect(await screen.findByDisplayValue('one-time-secret')).toBeInTheDocument();
    expect(api.issueCredential).toHaveBeenCalledWith(
      'token',
      { kind: 'workspace', id: 'workspace' },
      {
        label: 'Integration',
        notes: '',
        types: ['api'],
      },
    );
    expect(api.listCredentials).toHaveBeenCalledTimes(2);
    await user.click(screen.getByTestId('api-key-done'));
    expect(screen.queryByDisplayValue('one-time-secret')).toBeNull();
    expect(screen.getByText('Integration')).toBeInTheDocument();
    expect(JSON.stringify([...cache.values()])).not.toContain('one-time-secret');
    expect([...cache.values()].some((entry) => entry.data?.items?.[0]?.id === credential.id)).toBe(
      true,
    );
  });

  it.each([
    [new ApiError('Forbidden', 403), en.apiKeys.forbidden],
    [new SessionExpiredError(), en.apiKeys.sessionExpired],
    [new Error('offline'), en.apiKeys.loadError],
  ])('classifies a failed read and disables creation: %s', async (error, message) => {
    api.listCredentials.mockRejectedValue(error);
    renderKeys();
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByTestId('api-key-add')).toBeDisabled();
  });

  it('sends the URL page and sort to the API, then reads a different page', async () => {
    window.history.replaceState(
      null,
      '',
      '/en/workspaces/workspace?credentials.page=2&credentials.sort=label:asc',
    );
    api.listCredentials.mockResolvedValue(state([credential], 30));
    const view = renderKeys();
    await waitFor(() =>
      expect(api.listCredentials).toHaveBeenLastCalledWith(
        'token',
        { kind: 'workspace', id: 'workspace' },
        { offset: 10, limit: 10, sort: 'label:asc', q: '', locale: 'en' },
      ),
    );
    // Next updates useSearchParams after replaceState; feed that URL back to the test render.
    window.history.replaceState(
      null,
      '',
      '/en/workspaces/workspace?credentials.page=3&credentials.sort=label:asc',
    );
    view.reload();
    await waitFor(() =>
      expect(api.listCredentials).toHaveBeenLastCalledWith(
        'token',
        { kind: 'workspace', id: 'workspace' },
        { offset: 20, limit: 10, sort: 'label:asc', q: '', locale: 'en' },
      ),
    );
  });
});
