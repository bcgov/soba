import { describe, it, expect, vi, afterEach } from 'vitest';
import { getFormSubmitterAudience, setSubmitterAudience } from '@/src/shared/api/sobaApiGroups';

function response(body: unknown = {}, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

describe('sobaApiGroups submitter audience', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the sort locale as both the locale param and Accept-Language on a read', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetchMock);

    await getFormSubmitterAudience('tok', 'f1', 'fr');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/design/forms/f1/submitter-audience?locale=fr');
    expect(init.headers['Accept-Language']).toBe('fr');
  });

  it('sends the sort locale on a save, alongside the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetchMock);

    await setSubmitterAudience('tok', 'ws1', { mode: 'public' }, 'en');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('locale=en');
    expect(init.method).toBe('PUT');
    expect(init.headers['Accept-Language']).toBe('en');
    expect(JSON.parse(init.body)).toEqual({ mode: 'public' });
  });
});
