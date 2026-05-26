import { FormioCommunityEditionAPIv5Client } from '../../../src/plugins/formio-v5/formioV5Client';

/** Covers admin 440 refresh and the `opts.token` branch still used by the proxy until that forwarding is removed. */
describe('FormioCommunityEditionAPIv5Client 440 recovery', () => {
  const baseUrl = 'http://formio.test';
  const origFetch = global.fetch;

  afterEach(() => {
    global.fetch = origFetch;
    jest.restoreAllMocks();
  });

  it('re-logs in and retries once when admin JWT returns 440', async () => {
    const client = new FormioCommunityEditionAPIv5Client({
      baseUrl,
      username: 'admin@test',
      password: 'secret',
    });
    (client as unknown as { token: string | null }).token = 'stale-jwt';

    const loginHeaders = new Headers();
    loginHeaders.set('x-jwt-token', 'fresh-jwt');

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 440,
        text: () => Promise.resolve('Token expired'),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: loginHeaders,
        text: () => Promise.resolve(''),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify([{ _id: 'form1', title: 'One' }])),
      } as Response);

    const forms = await client.loadForms();
    expect(forms).toEqual([{ _id: 'form1', title: 'One' }]);

    expect(jest.mocked(global.fetch)).toHaveBeenCalledTimes(3);
    const urls = jest.mocked(global.fetch).mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toBe(`${baseUrl}/form`);
    expect(urls[1]).toBe(`${baseUrl}/admin/login`);
    expect(urls[2]).toBe(`${baseUrl}/form`);
  });

  it('does not call login when caller-supplied token gets 440', async () => {
    const client = new FormioCommunityEditionAPIv5Client({
      baseUrl,
      username: 'admin@test',
      password: 'secret',
    });
    (client as unknown as { token: string | null }).token = 'admin-jwt';

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 440,
      text: () => Promise.resolve('expired'),
    } as Response);

    await expect(
      client.loadForms(undefined, { token: 'user-supplied-expired' }),
    ).rejects.toMatchObject({ status: 440, name: 'FormioApiError' });

    expect(jest.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    expect(String(jest.mocked(global.fetch).mock.calls[0][0])).toBe(`${baseUrl}/form`);
    const init = jest.mocked(global.fetch).mock.calls[0][1] as RequestInit & {
      headers: Record<string, string>;
    };
    expect(init.headers['x-jwt-token']).toBe('user-supplied-expired');
  });
});
