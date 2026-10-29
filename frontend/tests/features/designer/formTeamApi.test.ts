import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchFormTeam,
  fetchTeamCandidates,
  addTeamMember,
} from '@/src/features/designer/data/formTeamApi';
import { sobaFetch } from '@/src/shared/api/sobaFetch';

vi.mock('@/src/shared/api/sobaFetch', () => ({ sobaFetch: vi.fn() }));

const query = { offset: 0, limit: 10, sort: 'name:asc', locale: 'en' as const };
const response = { items: [], page: { offset: 0, limit: 10, total: 0 } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sobaFetch).mockResolvedValue(Response.json(response));
});

describe('form team list requests', () => {
  it.each([undefined, '', '   '])('omits an empty search term (%j)', async (q) => {
    expect(await fetchFormTeam('token', 'form-1', { ...query, q })).toEqual(response);
    expect(sobaFetch).toHaveBeenCalledWith('/design/forms/form-1/team', {
      token: 'token',
      query,
    });
  });

  it('preserves paging, sort, locale and a nonempty search', async () => {
    await fetchFormTeam('token', 'form-1', { ...query, offset: 10, q: ' Jane ' });
    expect(sobaFetch).toHaveBeenCalledWith('/design/forms/form-1/team', {
      token: 'token',
      query: { ...query, offset: 10, q: 'Jane' },
    });
  });
});

describe('form team requests', () => {
  it('searches Soba users without sending empty search terms', async () => {
    await fetchTeamCandidates('token', 'form-1', '', 'en');
    expect(sobaFetch).toHaveBeenCalledWith('/design/forms/form-1/team/candidates', {
      token: 'token',
      query: { offset: 0, limit: 25, sort: 'name:asc', locale: 'en' },
    });
  });

  it('adds a user who has no workspace membership', async () => {
    await addTeamMember('token', 'form-1', null, ['group-1'], 'user-1');
    expect(sobaFetch).toHaveBeenCalledWith('/design/forms/form-1/team', {
      token: 'token',
      method: 'POST',
      json: { userId: 'user-1', groups: ['group-1'] },
    });
  });

  it('saves only the selected membership and group ids', async () => {
    await addTeamMember('token', 'form-1', 'membership-1', ['group-1']);
    expect(sobaFetch).toHaveBeenCalledWith('/design/forms/form-1/team', {
      token: 'token',
      method: 'POST',
      json: { membershipId: 'membership-1', groups: ['group-1'] },
    });
  });
});
