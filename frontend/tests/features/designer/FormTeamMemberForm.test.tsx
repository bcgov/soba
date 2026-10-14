import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react';

import dict from '@/dictionaries/en.json';

vi.mock('@/app/[lang]/Providers', () => ({ useDictionary: () => dict }));
vi.mock('@/src/features/designer/data/useFormTeam', { spy: true });

import FormTeamMemberForm from '@/src/features/designer/ui/FormTeamMemberForm';
import { useFormTeamMembers } from '@/src/features/designer/data/useFormTeam';
import type { TeamMember } from '@/src/types/formTeam';
import { click, clickTestId, failWrites, renderWithStore, resetTeam } from './formTeamTestKit';

const onDone = vi.fn();
const TOBIN = 'Select Tobin Venn (sample)';
const GROUPS_REQUIRED = 'Select at least one group.';

const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const tick = (name: string) => click(checkbox(name));
const save = () => clickTestId('team-save-button');
const searchFor = async (term: string) => {
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: term } });
  await clickTestId('search-team-user-button');
};
const memberById = (id: string) =>
  renderHook(() =>
    useFormTeamMembers({ offset: 0, limit: 10, sort: 'name:asc' }),
  ).result.current.rows.find((member) => member.id === id);

const renderForm = (member?: TeamMember) =>
  renderWithStore(<FormTeamMemberForm dict={dict} member={member} onDone={onDone} />);
/** The add form with Tobin, who is not on the team yet (user-2), found and ticked. */
const renderWithTobinChosen = async () => {
  renderForm();
  await searchFor('tobin');
  await tick(TOBIN);
};
/** The edit form for Dax (user-4), who starts in Group 2. */
const renderEditOfDax = () => renderForm(memberById('user-4'));

describe('FormTeamMemberForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTeam();
  });

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
    await tick('Select Orla Venn (sample)');
    await tick(TOBIN);

    expect(checkbox('Select Orla Venn (sample)')).not.toBeChecked();
    expect(checkbox(TOBIN)).toBeChecked();
  });

  it('holds the add until a user is chosen', async () => {
    renderForm();
    expect(screen.getByTestId('team-save-button')).toBeDisabled();

    await searchFor('tobin');
    await tick(TOBIN);
    expect(screen.getByTestId('team-save-button')).toBeEnabled();
  });

  it('asks for a group instead of adding a user with none', async () => {
    await renderWithTobinChosen();
    await save();

    expect(await screen.findByText(GROUPS_REQUIRED)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(memberById('user-2')).toBeUndefined();
  });

  it('asks for a group instead of saving a member with none', async () => {
    renderEditOfDax();
    await tick('Group 2');
    await save();

    expect(await screen.findByText(GROUPS_REQUIRED)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(memberById('user-4')?.groups).toEqual(['group-2']);
  });

  it('adds the chosen user with the chosen groups', async () => {
    await renderWithTobinChosen();
    await tick('Group 3');
    await save();

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(memberById('user-2')?.groups).toEqual(['group-3']);
  });

  it('saves the edited groups of a member', async () => {
    renderEditOfDax();
    await tick('Group 1');
    await save();

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(memberById('user-4')?.groups).toEqual(['group-2', 'group-1']);
  });

  it('marks the groups as required', () => {
    renderForm();
    expect(screen.getByRole('group', { name: /Assign groups.*\(required\)/ })).toBeInTheDocument();
  });

  it('keeps the chosen user and groups when the add fails', async () => {
    failWrites();
    await renderWithTobinChosen();
    await tick('Group 3');
    await save();

    await waitFor(() => expect(screen.getByTestId('team-save-button')).toBeEnabled());
    expect(onDone).not.toHaveBeenCalled();
    expect(checkbox(TOBIN)).toBeChecked();
    expect(checkbox('Group 3')).toBeChecked();
    expect(memberById('user-2')).toBeUndefined();
  });

  it('changes nothing on cancel', async () => {
    renderForm();
    await clickTestId('team-cancel-button');
    expect(onDone).toHaveBeenCalled();
    expect(memberById('user-2')).toBeUndefined();
  });
});
