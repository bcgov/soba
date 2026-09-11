import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/src/shared/config/runtimeConfig', () => ({
  getSobaApiBaseUrl: () => 'http://api.test/api/v1',
}));

import { fetchFeatureAvailability } from '@/src/shared/featureFlags/featureAvailability';

describe('fetchFeatureAvailability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('queries the scope and returns the backend result', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ code: 'x', available: true }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchFeatureAvailability('x', { workspaceId: 'w1', formId: 'f2' });

    expect(result).toBe(true);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/meta/feature-availability?');
    expect(url).toContain('code=x');
    expect(url).toContain('workspaceId=w1');
    expect(url).toContain('formId=f2');
  });

  it('fails closed (false) on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(fetchFeatureAvailability('x', { workspaceId: 'w1' })).resolves.toBe(false);
  });

  it('fails closed (false) when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    await expect(fetchFeatureAvailability('x')).resolves.toBe(false);
  });
});
