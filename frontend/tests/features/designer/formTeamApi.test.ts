import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  addFormTeamMember,
  listFormTeam,
  listFormTeamGroups,
  removeFormTeamMember,
  setFormTeamGroups,
} from '@/src/features/designer/data/formTeamApi';

const respond = (status: number, body: unknown = {}) =>
  ({
    ok: status < 400,
    status,
    headers: { get: () => null },
    json: async () => body,
  }) as unknown as Response;

const stubFetch = (status = 200, body: unknown = {}) => {
  const fetchMock = vi.fn().mockResolvedValue(respond(status, body));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const call = (fetchMock: ReturnType<typeof stubFetch>) => {
  const [url, init] = fetchMock.mock.calls[0];
  return { url: String(url), init };
};

describe('form team API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads one page of the form's team", async () => {
    const fetchMock = stubFetch(200, { items: [], page: { offset: 0, limit: 10, total: 0 } });

    await listFormTeam('tok', 'f1', { offset: 10, limit: 10, sort: 'name:asc', q: 'ada' });

    const { url, init } = call(fetchMock);
    expect(url).toMatch(/\/design\/forms\/f1\/team\?/);
    expect(url).toContain('offset=10');
    expect(url).toContain('q=ada');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('reads the groups a member can be put in', async () => {
    const fetchMock = stubFetch(200, { items: [] });

    await listFormTeamGroups('tok', 'f1', 'en');

    expect(call(fetchMock).url).toMatch(/\/design\/forms\/f1\/team\/groups/);
  });

  it('adds a person with their groups', async () => {
    const fetchMock = stubFetch(201, { id: 'm-1' });

    await addFormTeamMember('tok', 'f1', { userId: 'u1', groupIds: ['g1'] });

    const { url, init } = call(fetchMock);
    expect(url).toMatch(/\/design\/forms\/f1\/team$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ userId: 'u1', groupIds: ['g1'] });
  });

  it("replaces a member's groups", async () => {
    const fetchMock = stubFetch(200, { id: 'm-1' });

    await setFormTeamGroups('tok', 'f1', 'm-1', ['g2']);

    const { url, init } = call(fetchMock);
    expect(url).toMatch(/\/design\/forms\/f1\/team\/m-1\/groups$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ groupIds: ['g2'] });
  });

  it('removes a member, and counts one already gone as removed', async () => {
    const fetchMock = stubFetch(404);

    await expect(removeFormTeamMember('tok', 'f1', 'm-1')).resolves.toBeUndefined();

    const { url, init } = call(fetchMock);
    expect(url).toMatch(/\/design\/forms\/f1\/team\/m-1$/);
    expect(init.method).toBe('DELETE');
  });
});
