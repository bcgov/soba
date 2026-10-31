import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCredentialWriter,
  useCredentials,
} from '@/src/features/credentials/data/useCredentials';
const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  issue: vi.fn(),
  token: vi.fn(),
  read: vi.fn(),
}));
vi.mock('swr', () => ({ useSWRConfig: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ idTokenParsed: { sub: 'user' } }),
}));
vi.mock('@/src/shared/api/callToken', () => ({
  useCallToken: () => ({ signedInToken: mocks.token }),
}));
vi.mock('@/src/shared/api/useAuthedSWR', () => ({
  useAuthedSWR: mocks.read,
}));
vi.mock('@/src/features/credentials/data/api', () => ({ issueCredential: mocks.issue }));
const query = { offset: 0, limit: 10, sort: 'createdAt:desc' };
const readKey = [
  'credentials',
  'workspace',
  'workspace',
  'user',
  0,
  10,
  'createdAt:desc',
  '',
  'en',
];
const input = { label: 'Integration', notes: 'Vault reference', types: ['api' as const] };
const metadata = {
  ...input,
  id: 'new',
  status: 'active' as const,
  createdAt: '',
  updatedAt: '',
  rotatedAt: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.token.mockReturnValue('current-token');
  mocks.mutate.mockResolvedValue(undefined);
  mocks.read.mockReturnValue({ data: { available: true, items: [] }, mutate: mocks.mutate });
  mocks.issue.mockResolvedValue({ credential: metadata, apiKey: 'secret-key' });
});
describe('credential reader and writer', () => {
  it('keeps a form collection separate from a workspace with the same id', async () => {
    const scope = { kind: 'form' as const, id: 'workspace' };
    const { result } = renderHook(() => ({
      reader: useCredentials(scope, query),
      writer: useCredentialWriter(scope),
    }));
    expect(mocks.read.mock.calls[0][0]).toEqual([
      'credentials',
      'form',
      'workspace',
      'user',
      0,
      10,
      'createdAt:desc',
      '',
      'en',
    ]);
    await result.current.writer.generate(input);
    expect(mocks.issue).toHaveBeenCalledWith('current-token', scope, input);
    expect(mocks.mutate.mock.calls[0][0](['credentials', 'form', 'workspace', 'user', 0])).toBe(
      true,
    );
    expect(mocks.mutate.mock.calls[0][0](readKey)).toBe(false);
  });

  it('reads and refreshes metadata without exposing a write action', async () => {
    const { result } = renderHook(() =>
      useCredentials({ kind: 'workspace', id: 'workspace' }, query),
    );
    expect(result.current.data).toEqual({ available: true, items: [] });
    expect(mocks.read.mock.calls[0][0]).toEqual(readKey);
    expect(result.current).not.toHaveProperty('generate');
    await result.current.refresh();
    expect(mocks.mutate).toHaveBeenCalledWith();
    expect(mocks.issue).not.toHaveBeenCalled();
  });
  it('re-reads all pages in its scope without putting the secret in the cache', async () => {
    const { result } = renderHook(() =>
      useCredentialWriter({ kind: 'workspace', id: 'workspace' }),
    );
    expect((await result.current.generate(input)).apiKey).toBe('secret-key');
    const [matches] = mocks.mutate.mock.calls[0];
    expect(matches(readKey)).toBe(true);
    expect(matches([...readKey.slice(0, 4), 10, 10, 'label:asc', '', 'en'])).toBe(true);
    expect(matches(['credentials', 'workspace', 'other', 'user'])).toBe(false);
    expect(matches(['credentials', 'workspace', 'workspace', 'other-user'])).toBe(false);
    expect(mocks.mutate.mock.calls[0]).toHaveLength(1);
  });
  it('refreshes after an ambiguous failure without replaying the write', async () => {
    mocks.issue.mockRejectedValue(new Error('lost response'));
    const { result } = renderHook(() =>
      useCredentialWriter({ kind: 'workspace', id: 'workspace' }),
    );
    await expect(result.current.generate(input)).rejects.toThrow('lost response');
    expect(mocks.issue).toHaveBeenCalledTimes(1);
    expect(mocks.mutate.mock.calls[0][0](readKey)).toBe(true);
  });
  it('still returns the one-time key when updating metadata fails', async () => {
    mocks.mutate.mockRejectedValue(new Error('cache failure'));
    const { result } = renderHook(() =>
      useCredentialWriter({ kind: 'workspace', id: 'workspace' }),
    );
    expect((await result.current.generate(input)).apiKey).toBe('secret-key');
    expect(mocks.issue).toHaveBeenCalledTimes(1);
  });
  it('preserves the original issuance error when the recovery refresh also fails', async () => {
    const failure = new Error('lost response');
    mocks.issue.mockRejectedValue(failure);
    mocks.mutate.mockRejectedValue(new Error('refresh failed'));
    const { result } = renderHook(() =>
      useCredentialWriter({ kind: 'workspace', id: 'workspace' }),
    );
    await expect(result.current.generate(input)).rejects.toBe(failure);
    expect(mocks.issue).toHaveBeenCalledTimes(1);
  });
  it('updates the original workspace cache when the workspace changes during issuance', async () => {
    let resolve!: (value: { credential: typeof metadata; apiKey: string }) => void;
    mocks.issue.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result, rerender } = renderHook(
      ({ workspaceId }) => useCredentialWriter({ kind: 'workspace', id: workspaceId }),
      {
        initialProps: { workspaceId: 'original' },
      },
    );
    const pending = result.current.generate(input);
    rerender({ workspaceId: 'other' });
    resolve({ credential: metadata, apiKey: 'secret-key' });
    await pending;
    expect(mocks.mutate.mock.calls[0][0](['credentials', 'workspace', 'original', 'user', 0])).toBe(
      true,
    );
    expect(mocks.mutate.mock.calls[0][0](['credentials', 'workspace', 'other', 'user', 0])).toBe(
      false,
    );
  });
  it('never issues anonymously after the session ends', async () => {
    mocks.token.mockImplementation(() => {
      throw new Error('Session expired');
    });
    const { result } = renderHook(() =>
      useCredentialWriter({ kind: 'workspace', id: 'workspace' }),
    );
    await expect(result.current.generate(input)).rejects.toThrow('Session expired');
    expect(mocks.issue).not.toHaveBeenCalled();
  });
});
