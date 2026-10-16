import { act } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import {
  resetFormTeam,
  useFormTeamMembers,
  useFormTeamWriter,
  useUserSearch,
} from '@/src/features/designer/data/useFormTeam';

const FORM_ID = 'f1';
const firstPage = { offset: 0, limit: 10, sort: 'name:asc' };

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);
const listOf = (formId: string) => renderHook(() => useFormTeamMembers(formId, firstPage));
const writerFor = (formId: string) => renderHook(() => useFormTeamWriter(formId)).result.current;
const search = (q: string) => renderHook(() => useUserSearch(FORM_ID, q)).result.current;

describe('useFormTeam', () => {
  beforeEach(() => act(() => resetFormTeam()));

  it('lists the team by name', () => {
    const { result } = listOf(FORM_ID);
    expect(result.current.total).toBe(4);
    expect(ids(result.current.rows)).toEqual(['user-4', 'user-3', 'user-1', 'user-5']);
  });

  it('pages the team', () => {
    const { result } = renderHook(() =>
      useFormTeamMembers(FORM_ID, { ...firstPage, offset: 2, limit: 2 }),
    );
    expect(result.current.total).toBe(4);
    expect(ids(result.current.rows)).toEqual(['user-1', 'user-5']);
  });

  it('searches the team by name or email', () => {
    const byName = renderHook(() => useFormTeamMembers(FORM_ID, { ...firstPage, q: 'quist' }));
    expect(ids(byName.result.current.rows)).toEqual(['user-3']);
    const byEmail = renderHook(() =>
      useFormTeamMembers(FORM_ID, { ...firstPage, q: 'dax.halloran@' }),
    );
    expect(ids(byEmail.result.current.rows)).toEqual(['user-4']);
  });

  it('finds no users until there is a search term', () => {
    expect(search(' ')).toEqual([]);
    expect(ids(search('venn'))).toEqual(['user-1', 'user-2']);
  });

  it('marks the users already on the team', () => {
    const [orla, tobin] = search('venn');
    expect(orla.onTeam).toBe(true);
    expect(tobin.onTeam).toBe(false);
  });

  it('adds, regroups and removes a member, saying each write applied', async () => {
    const list = listOf(FORM_ID);
    const writer = writerFor(FORM_ID);
    const [, tobin] = search('venn');
    const tobinRow = () => list.result.current.rows.find((member) => member.id === tobin.id);
    const applied = { status: 'applied', value: undefined };

    await expect(act(() => writer.add(tobin, ['group-3']))).resolves.toEqual(applied);
    expect(tobinRow()?.groups).toEqual(['group-3']);

    await expect(act(() => writer.setGroups(tobin.id, ['group-1', 'group-2']))).resolves.toEqual(
      applied,
    );
    expect(tobinRow()?.groups).toEqual(['group-1', 'group-2']);

    await expect(act(() => writer.remove(tobin.id))).resolves.toEqual(applied);
    expect(tobinRow()).toBeUndefined();
    expect(list.result.current.total).toBe(4);
  });

  it('refuses to add a user already on the team', async () => {
    const list = listOf(FORM_ID);
    const [orla] = search('orla');

    await expect(writerFor(FORM_ID).add(orla, ['group-4'])).rejects.toThrow('already on the team');
    expect(list.result.current.rows.find((member) => member.id === orla.id)?.groups).toEqual([
      'group-1',
    ]);
  });

  it('keeps each form its own team', async () => {
    const other = listOf('f2');
    const writer = writerFor(FORM_ID);
    await act(() => writer.remove('user-4'));

    expect(listOf(FORM_ID).result.current.total).toBe(3);
    expect(other.result.current.total).toBe(4);
  });
});
