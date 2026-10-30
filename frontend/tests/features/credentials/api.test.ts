import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listCredentials, issueCredential } from '@/src/features/credentials/data/api';
import { ApiError } from '@/src/shared/api/sobaHelpers';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/src/shared/api/sobaFetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/shared/api/sobaFetch')>()),
  sobaFetch: mocks.fetch,
}));

const credential = {
  id: '01900000-0000-7000-8000-000000000001',
  label: 'Integration',
  notes: '',
  types: ['api'],
  status: 'active',
  createdAt: '2026-10-09T15:53:52Z',
  updatedAt: '2026-10-09T15:53:52Z',
  rotatedAt: null,
};
const query = { offset: 0, limit: 10, sort: 'createdAt:desc' };
const page = { offset: 0, limit: 10, total: 0 };
const input = { label: 'Integration', notes: '', types: ['api' as const] };

beforeEach(() => vi.resetAllMocks());

describe('credential API response validation', () => {
  it('uses the form path for form reads and creates', async () => {
    const scope = { kind: 'form' as const, id: 'form/id' };
    mocks.fetch.mockResolvedValueOnce(
      Response.json({ available: true, items: [], page, filters: {}, sort: query.sort }),
    );
    await listCredentials('token', scope, query);
    expect(mocks.fetch).toHaveBeenLastCalledWith('/design/forms/form%2Fid/credentials', {
      token: 'token',
      query,
      headers: {},
    });
    mocks.fetch.mockResolvedValueOnce(Response.json({ credential, apiKey: 'secret' }));
    await issueCredential('token', scope, input);
    expect(mocks.fetch).toHaveBeenLastCalledWith('/design/forms/form%2Fid/credentials', {
      token: 'token',
      method: 'POST',
      json: input,
    });
  });

  it('returns valid credential metadata and one-time secrets', async () => {
    const state = {
      available: true,
      items: [credential],
      page: { ...page, total: 1 },
      filters: {},
      sort: query.sort,
    };
    mocks.fetch.mockResolvedValueOnce(Response.json(state));
    expect(await listCredentials('token', { kind: 'workspace', id: 'workspace' }, query)).toEqual(
      state,
    );
    const secret = { credential, apiKey: 'one-time-secret' };
    mocks.fetch.mockResolvedValueOnce(Response.json(secret));
    expect(await issueCredential('token', { kind: 'workspace', id: 'workspace' }, input)).toEqual(
      secret,
    );
  });

  it.each([
    { available: true, items: {} },
    { available: true, items: [{ ...credential, types: undefined }] },
    { available: true, items: [{ ...credential, types: ['unsupported'] }] },
  ])('rejects malformed list responses before rendering: %j', async (body) => {
    mocks.fetch.mockResolvedValueOnce(
      Response.json({ page, filters: {}, sort: query.sort, ...body }),
    );
    await expect(
      listCredentials('token', { kind: 'workspace', id: 'workspace' }, query),
    ).rejects.toThrow();
  });

  it('rejects malformed issuance responses before caching metadata', async () => {
    mocks.fetch.mockResolvedValueOnce(
      Response.json({ credential: { ...credential, types: null }, apiKey: 'one-time-secret' }),
    );
    await expect(
      issueCredential('token', { kind: 'workspace', id: 'workspace' }, input),
    ).rejects.toThrow();
  });

  it('preserves HTTP errors for the existing error handling', async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ error: 'Forbidden' }, { status: 403 }));
    await expect(
      listCredentials('token', { kind: 'workspace', id: 'workspace' }, query),
    ).rejects.toEqual(new ApiError('Forbidden', 403));
  });
});
