import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';

import dict from '@/dictionaries/en.json';

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => dict,
}));

const { failWrites } = vi.hoisted(() => ({ failWrites: { on: false } }));

// The sample writer cannot fail, so a failed save is forced here.
vi.mock('@/src/features/designer/data/useFormTeam', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/features/designer/data/useFormTeam')>();
  const refuse = () => Promise.reject(new Error('refused'));
  return {
    ...actual,
    useFormTeamWriter: () =>
      failWrites.on
        ? { add: refuse, setGroups: refuse, remove: refuse }
        : actual.useFormTeamWriter(),
  };
});

import makeStore from '@/lib/store';
import FormTeamMemberForm from '@/src/features/designer/ui/FormTeamMemberForm';
import { resetFormTeam, useFormTeamMembers } from '@/src/features/designer/data/useFormTeam';
import type { TeamMember } from '@/src/types/formTeam';

const onDone = vi.fn();

const click = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};
const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const searchFor = async (term: string) => {
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: term } });
  await click(screen.getByTestId('search-team-user-button'));
};
const team = () =>
  renderHook(() => useFormTeamMembers({ offset: 0, limit: 10, sort: 'name:asc' })).result.current
    .rows;

describe('FormTeamMemberForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    failWrites.on = false;
    act(() => resetFormTeam());
  });

  const renderForm = (member?: TeamMember) =>
    render(
      <Provider store={makeStore()}>
        <FormTeamMemberForm dict={dict} member={member} onDone={onDone} />
      </Provider>,
    );

  it('shows no results until a search is run', async () => {
    renderForm();
    expect(screen.queryByText('Identity Provider')).toBeNull();

    await searchFor('venn');
    expect(screen.getByText('orla.venn@example.gov.bc.ca')).toBeInTheDocument();
    expect(screen.getByText('tobin.venn@example.gov.bc.ca')).toBeInTheDocument();
  });

  it('says so when the search finds nobody', async () => {
    renderForm();
    await searchFor('nobody at all');
    expect(screen.getByTestId('datatable-empty')).toHaveTextContent('No users found');
  });

  it('selects one user at a time', async () => {
    renderForm();
    await searchFor('venn');
    await click(checkbox('Select Orla Venn (sample)'));
    await click(checkbox('Select Tobin Venn (sample)'));

    expect(checkbox('Select Orla Venn (sample)')).not.toBeChecked();
    expect(checkbox('Select Tobin Venn (sample)')).toBeChecked();
  });

  it('holds the add until a user and a group are chosen', async () => {
    renderForm();
    expect(screen.getByTestId('team-save-button')).toBeDisabled();

    await searchFor('tobin');
    await click(checkbox('Select Tobin Venn (sample)'));
    expect(screen.getByTestId('team-save-button')).toBeDisabled();

    await click(checkbox('Group 3'));
    expect(screen.getByTestId('team-save-button')).toBeEnabled();
  });

  it('adds the chosen user with the chosen groups', async () => {
    renderForm();
    await searchFor('tobin');
    await click(checkbox('Select Tobin Venn (sample)'));
    await click(checkbox('Group 3'));
    await click(screen.getByTestId('team-save-button'));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(team().find((member) => member.id === 'user-2')?.groups).toEqual(['group-3']);
  });

  it('saves the edited groups of a member', async () => {
    const dax = team().find((member) => member.id === 'user-4') as TeamMember;
    renderForm(dax);
    await click(checkbox('Group 1'));
    await click(screen.getByTestId('team-save-button'));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(team().find((member) => member.id === 'user-4')?.groups).toEqual(['group-2', 'group-1']);
  });

  it('marks the groups as required', () => {
    renderForm();
    expect(screen.getByRole('group', { name: /Assign groups.*\(required\)/ })).toBeInTheDocument();
  });

  it('keeps the chosen user and groups when the add fails', async () => {
    failWrites.on = true;
    renderForm();
    await searchFor('tobin');
    await click(checkbox('Select Tobin Venn (sample)'));
    await click(checkbox('Group 3'));
    await click(screen.getByTestId('team-save-button'));

    await waitFor(() => expect(screen.getByTestId('team-save-button')).toBeEnabled());
    expect(onDone).not.toHaveBeenCalled();
    expect(checkbox('Select Tobin Venn (sample)')).toBeChecked();
    expect(checkbox('Group 3')).toBeChecked();
    expect(team().find((member) => member.id === 'user-2')).toBeUndefined();
  });

  it('changes nothing on cancel', async () => {
    renderForm();
    await click(screen.getByTestId('team-cancel-button'));
    expect(onDone).toHaveBeenCalled();
    expect(team()).toHaveLength(4);
  });
});
