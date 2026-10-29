import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';
import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import {
  useFormTeamMembers,
  useFormTeamWriter,
  useTeamGroups,
  useFormTeamCandidates,
} from '@/src/features/designer/data/useFormTeam';
import * as api from '@/src/features/designer/data/formTeamApi';
import { workspacePerson } from './formTeamTestKit';

vi.mock('@/src/features/designer/data/formTeamApi', () => ({
  fetchFormTeam: vi.fn(),
  fetchTeamGroups: vi.fn(),
  fetchTeamCandidates: vi.fn(),
  addTeamMember: vi.fn(),
  setTeamMemberGroups: vi.fn(),
  removeTeamMember: vi.fn(),
}));
let store: ReturnType<typeof makeStore>;
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
      >
        {children}
      </SWRConfig>
    </Provider>
  );
}
const query = { offset: 0, limit: 10, sort: 'name:asc' };
const member = { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com', groups: ['group-1'] };

describe('live form team hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    store.dispatch(setToken('token'));
    store.dispatch(setAuthenticated(true));
    vi.mocked(api.fetchFormTeam).mockResolvedValue({
      items: [member],
      page: { offset: 0, limit: 10, total: 1 },
    });
    vi.mocked(api.fetchTeamGroups).mockResolvedValue({
      items: [{ id: 'group-1', name: 'Designers' }],
    });
    vi.mocked(api.addTeamMember).mockResolvedValue(member);
    vi.mocked(api.fetchTeamCandidates).mockResolvedValue({
      items: [],
      page: { offset: 0, limit: 25, total: 0 },
    });
    vi.mocked(api.setTeamMemberGroups).mockResolvedValue(member);
  });

  it('loads actual groups and a server-paged form team', async () => {
    const { result } = renderHook(
      () => ({ team: useFormTeamMembers('f1', query), groups: useTeamGroups('f1') }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.team.total).toBe(1));
    expect(result.current.team.rows).toEqual([member]);
    await waitFor(() =>
      expect(result.current.groups.groups).toEqual([{ id: 'group-1', name: 'Designers' }]),
    );
    expect(api.fetchFormTeam).toHaveBeenCalledWith('token', 'f1', { ...query, locale: 'en' });
  });

  it('refreshes the list after persisting a selected workspace membership and groups', async () => {
    const person = workspacePerson('jane', 'Jane Doe');
    const { result } = renderHook(
      () => ({ team: useFormTeamMembers('f1', query), writer: useFormTeamWriter('f1') }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.team.total).toBe(1));
    vi.mocked(api.fetchFormTeam).mockResolvedValue({
      items: [],
      page: { offset: 0, limit: 10, total: 0 },
    });
    await act(async () => {
      await result.current.writer.add(person, ['group-1']);
    });
    expect(api.addTeamMember).toHaveBeenCalledWith('token', 'f1', person.membershipId, ['group-1']);
    expect(result.current.team.total).toBe(0);
  });

  it('debounces workspace member searches and hides results for the previous term', async () => {
    const candidate = {
      id: 'user-2',
      membershipId: 'membership-2',
      name: 'Jane',
      email: 'jane@example.com',
    };
    vi.mocked(api.fetchTeamCandidates).mockResolvedValue({
      items: [candidate],
      page: { offset: 0, limit: 25, total: 1 },
    });
    const { result, rerender } = renderHook(({ term }) => useFormTeamCandidates('f1', term), {
      initialProps: { term: '' },
      wrapper,
    });
    await waitFor(() => expect(result.current.members).toEqual([candidate]));
    rerender({ term: 'Jane' });
    expect(result.current.members).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() =>
      expect(api.fetchTeamCandidates).toHaveBeenCalledWith('token', 'f1', 'Jane', 'en'),
    );
    await waitFor(() => expect(result.current.members).toEqual([candidate]));
  });

  it('sends edits and removal to the current form only', async () => {
    const { result } = renderHook(() => useFormTeamWriter('f1'), { wrapper });
    await act(async () => {
      await result.current.setGroups('user-1', ['group-2']);
      await result.current.remove('user-1');
    });
    expect(api.setTeamMemberGroups).toHaveBeenCalledWith('token', 'f1', 'user-1', ['group-2']);
    expect(api.removeTeamMember).toHaveBeenCalledWith('token', 'f1', 'user-1');
  });

  it('propagates a refused add and sends nothing when the session has ended', async () => {
    vi.mocked(api.addTeamMember).mockRejectedValueOnce(new Error('refused'));
    const { result } = renderHook(() => useFormTeamWriter('f1'), { wrapper });
    await expect(
      result.current.add(workspacePerson('jane', 'Jane Doe'), ['group-1']),
    ).rejects.toThrow('refused');
    store.dispatch(setToken(''));
    await expect(
      result.current.add(workspacePerson('jane', 'Jane Doe'), ['group-1']),
    ).rejects.toThrow();
    expect(api.addTeamMember).toHaveBeenCalledTimes(1);
  });
});
