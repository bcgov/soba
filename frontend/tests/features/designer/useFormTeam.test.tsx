import { act } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import {
  resetFormTeam,
  useFormTeamMembers,
  useFormTeamWriter,
  useUserSearch,
} from '@/src/features/designer/data/useFormTeam';

const firstPage = { offset: 0, limit: 10, sort: 'name:asc' };

describe('useFormTeam', () => {
  beforeEach(() => act(() => resetFormTeam()));

  it('lists the team by name', () => {
    const { result } = renderHook(() => useFormTeamMembers(firstPage));
    expect(result.current.total).toBe(4);
    expect(result.current.rows.map((member) => member.id)).toEqual([
      'user-4',
      'user-3',
      'user-1',
      'user-5',
    ]);
  });

  it('pages the team', () => {
    const { result } = renderHook(() => useFormTeamMembers({ ...firstPage, offset: 2, limit: 2 }));
    expect(result.current.total).toBe(4);
    expect(result.current.rows.map((member) => member.id)).toEqual(['user-1', 'user-5']);
  });

  it('searches the team by name or email', () => {
    const byName = renderHook(() => useFormTeamMembers({ ...firstPage, q: 'quist' }));
    expect(byName.result.current.rows.map((member) => member.id)).toEqual(['user-3']);
    const byEmail = renderHook(() => useFormTeamMembers({ ...firstPage, q: 'dax.halloran@' }));
    expect(byEmail.result.current.rows.map((member) => member.id)).toEqual(['user-4']);
  });

  it('finds no users until there is a search term', () => {
    expect(renderHook(() => useUserSearch(' ')).result.current).toEqual([]);
    const found = renderHook(() => useUserSearch('venn')).result.current;
    expect(found.map((user) => user.id)).toEqual(['user-1', 'user-2']);
  });

  it('adds, regroups and removes a member', async () => {
    const list = renderHook(() => useFormTeamMembers(firstPage));
    const writer = renderHook(() => useFormTeamWriter()).result.current;
    const [, tobin] = renderHook(() => useUserSearch('venn')).result.current;
    const tobinRow = () => list.result.current.rows.find((member) => member.id === tobin.id);

    await act(() => writer.add(tobin, ['group-3']));
    expect(tobinRow()?.groups).toEqual(['group-3']);

    await act(() => writer.setGroups(tobin.id, ['group-1', 'group-2']));
    expect(tobinRow()?.groups).toEqual(['group-1', 'group-2']);

    await act(() => writer.remove(tobin.id));
    expect(tobinRow()).toBeUndefined();
    expect(list.result.current.total).toBe(4);
  });

  it('regroups a user who is added twice', async () => {
    const list = renderHook(() => useFormTeamMembers(firstPage));
    const writer = renderHook(() => useFormTeamWriter()).result.current;
    const [orla] = renderHook(() => useUserSearch('orla')).result.current;

    await act(() => writer.add(orla, ['group-4']));
    expect(list.result.current.total).toBe(4);
    expect(list.result.current.rows.find((member) => member.id === orla.id)?.groups).toEqual([
      'group-4',
    ]);
  });
});
