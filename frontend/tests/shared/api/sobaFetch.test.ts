import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sobaFetch } from '@/src/shared/api/sobaFetch';
import {
  getWorkspaceId,
  setWorkspaceId,
  clearWorkspaceId,
} from '@/src/shared/workspace/workspaceStore';
import { setWorkspaceResolvedListener } from '@/src/shared/workspace/workspaceSync';

function mockResponse(workspaceHeader: string | null) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === 'x-soba-workspace-id' ? workspaceHeader : null,
    },
    json: async () => ({}),
  } as unknown as Response;
}

describe('sobaFetch', () => {
  beforeEach(() => {
    clearWorkspaceId();
    setWorkspaceResolvedListener(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends Authorization and a workspaceId query param, never a workspace request header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(null));
    vi.stubGlobal('fetch', fetchMock);

    await sobaFetch('/forms', { token: 'tok', workspaceId: 'wsX' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/forms?workspaceId=wsX');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers.Accept).toBe('application/json');
    expect(Object.keys(init.headers)).not.toContain('x-soba-workspace-id');
  });

  it('captures the echoed x-soba-workspace-id header into the store and notifies listeners', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse('wsEcho'));
    vi.stubGlobal('fetch', fetchMock);
    const seen: string[] = [];
    setWorkspaceResolvedListener((id) => seen.push(id));

    await sobaFetch('/forms/abc', { token: 'tok' });

    expect(getWorkspaceId()).toBe('wsEcho');
    expect(seen).toEqual(['wsEcho']);
  });

  it('does not re-notify when the echoed workspace already matches the store', async () => {
    setWorkspaceId('wsSame');
    const fetchMock = vi.fn().mockResolvedValue(mockResponse('wsSame'));
    vi.stubGlobal('fetch', fetchMock);
    const seen: string[] = [];
    setWorkspaceResolvedListener((id) => seen.push(id));

    await sobaFetch('/forms/abc', { token: 'tok' });

    expect(seen).toEqual([]);
  });

  it('serializes a JSON body with a Content-Type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(null));
    vi.stubGlobal('fetch', fetchMock);

    await sobaFetch('/forms', { token: 'tok', method: 'POST', json: { a: 1 }, workspaceId: 'wsX' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });
});
