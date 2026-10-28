import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCredential } from '@/src/features/credentials/data/useCredential';
const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  issue: vi.fn(),
  regenerate: vi.fn(),
  save: vi.fn(),
  data: { available: true, credential: null as unknown },
}));
vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ token: 'token', authenticated: true }),
}));
vi.mock('@/src/shared/api/useAuthedSWR', () => ({
  useAuthedSWR: () => ({ data: mocks.data, mutate: mocks.mutate }),
}));
vi.mock('@/src/features/credentials/data/api', () => ({
  issueCredential: mocks.issue,
  regenerateCredential: mocks.regenerate,
  saveCredentialNotes: mocks.save,
}));
const metadata = { id: 'local-id', status: 'active', notes: '' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.data.credential = null;
  mocks.mutate.mockResolvedValue(undefined);
  mocks.issue.mockResolvedValue({ credential: metadata, apiKey: 'secret-key' });
});
describe('credential resource', () => {
  it('demos generation, notes, and regeneration without calling endpoints or shared caches', async () => {
    const { result } = renderHook(() => useCredential('workspace', true));
    let id = '';
    await act(async () => {
      const generated = await result.current.generate();
      expect(generated.apiKey).toBe('fake-api-key-test');
      id = generated.credential.id;
    });
    expect(result.current.data?.credential?.id).toBe(id);
    await act(async () => {
      await result.current.saveNotes(id, 'Demo vault');
    });
    expect(result.current.data?.credential?.notes).toBe('Demo vault');
    await act(async () => {
      const regenerated = await result.current.generate();
      expect(regenerated.apiKey).toBe('fake-api-key-test');
      expect(regenerated.credential.id).toBe(id);
      expect(regenerated.credential.rotatedAt).not.toBeNull();
    });
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.regenerate).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('passes only metadata to the shared cache', async () => {
    const { result } = renderHook(() => useCredential('workspace', false));
    expect((await result.current.generate()).apiKey).toBe('secret-key');
    expect(mocks.mutate).toHaveBeenCalledWith(
      { available: true, credential: metadata },
      { revalidate: false },
    );
    expect(JSON.stringify(mocks.mutate.mock.calls)).not.toContain('secret-key');
  });
  it('refreshes metadata after an ambiguous failure without replaying the write', async () => {
    mocks.issue.mockRejectedValue(new Error('lost response'));
    const { result } = renderHook(() => useCredential('workspace', false));
    await expect(result.current.generate()).rejects.toThrow('lost response');
    expect(mocks.issue).toHaveBeenCalledTimes(1);
    expect(mocks.mutate).toHaveBeenCalledWith();
  });
  it('regenerates using the local record id', async () => {
    mocks.data.credential = metadata;
    mocks.regenerate.mockResolvedValue({ credential: metadata, apiKey: 'new-key' });
    const { result } = renderHook(() => useCredential('workspace', false));
    await result.current.generate();
    expect(mocks.regenerate).toHaveBeenCalledWith('token', 'workspace', 'local-id');
    expect(mocks.issue).not.toHaveBeenCalled();
  });
});
