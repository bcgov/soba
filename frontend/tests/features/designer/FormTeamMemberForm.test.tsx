import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, screen, waitFor } from '@testing-library/react';

import dict from '@/dictionaries/en.json';
import type { TeamCandidate } from '@/src/types/formTeam';

vi.mock('@/src/features/designer/data/useFormTeam', async () => {
  const sample = await import('./sampleFormTeam');
  return { ...sample, useFormTeamWriter: vi.fn(sample.useFormTeamWriter) };
});
vi.mock('@/src/features/designer/ui/FormTeamMemberPicker', () => ({
  FormTeamMemberPicker: ({
    formId,
    onSelect,
  }: {
    formId: string;
    onSelect?: (user: TeamCandidate | null) => void;
  }) => (
    <div data-testid="picker" data-scope={`form:${formId}`}>
      {[tobin, dax].map((person) => (
        <button
          key={person.membershipId}
          type="button"
          data-testid={`pick-${person.membershipId}`}
          onClick={() => onSelect?.(person)}
        >
          {person.name}
        </button>
      ))}
      <button type="button" data-testid="pick-clear" onClick={() => onSelect?.(null)}>
        Clear
      </button>
    </div>
  ),
}));

import FormTeamMemberForm from '@/src/features/designer/ui/FormTeamMemberForm';
import { useFormTeamMembers } from '@/src/features/designer/data/useFormTeam';
import type { TeamMember } from '@/src/types/formTeam';
import {
  click,
  clickTestId,
  failWrites,
  workspacePerson,
  renderWithStore,
  resetTeam,
} from './formTeamTestKit';

const onDone = vi.fn();
const FORM_ID = 'f1';
const GROUPS_REQUIRED = 'Select at least one group.';
/** Not on the team; an active workspace member. */
const tobin = workspacePerson('tobin', 'Venn, Tobin');
const TOBIN_ID = 'tobin';
/** On the sample team as user-4. */
const dax = workspacePerson('dax', 'Halloran, Dax', 'user-4');

const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const tick = (name: string) => click(checkbox(name));
const pick = (person: TeamCandidate) => clickTestId(`pick-${person.membershipId}`);
const save = () => clickTestId('team-save-button');
const memberById = (id: string) =>
  renderHook(() =>
    useFormTeamMembers(FORM_ID, { offset: 0, limit: 10, sort: 'name:asc' }),
  ).result.current.rows.find((member) => member.id === id);

const renderForm = (member?: TeamMember) =>
  renderWithStore(
    <FormTeamMemberForm dict={dict} formId={FORM_ID} member={member} onDone={onDone} />,
  );
const renderWithTobinPicked = async () => {
  renderForm();
  await pick(tobin);
};
/** The edit form for Dax (user-4), who starts in Group 2. */
const renderEditOfDax = () => renderForm(memberById('user-4'));

describe('FormTeamMemberForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTeam();
  });

  it('searches workspace members within the form scope', () => {
    renderForm();
    expect(screen.getByTestId('team-member-form')).toHaveTextContent(dict.team.searchStep);
    expect(screen.getByTestId('picker')).toHaveAttribute('data-scope', `form:${FORM_ID}`);
  });

  it('does not search when editing a member', () => {
    renderEditOfDax();
    expect(screen.queryByTestId('picker')).toBeNull();
  });

  it('holds the add until a person is picked', async () => {
    renderForm();
    expect(screen.getByTestId('team-save-button')).toBeDisabled();

    await pick(tobin);
    expect(screen.getByTestId('team-save-button')).toBeEnabled();

    await clickTestId('pick-clear');
    expect(screen.getByTestId('team-save-button')).toBeDisabled();
  });

  it('asks for a group instead of adding a user with none', async () => {
    await renderWithTobinPicked();
    await save();

    expect(await screen.findByText(GROUPS_REQUIRED)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(memberById(TOBIN_ID)).toBeUndefined();
  });

  it('asks for a group instead of saving a member with none', async () => {
    renderEditOfDax();
    await tick('Group 2');
    await save();

    expect(await screen.findByText(GROUPS_REQUIRED)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(memberById('user-4')?.groups).toEqual(['group-2']);
  });

  it('adds the picked person with the chosen groups', async () => {
    await renderWithTobinPicked();
    await tick('Group 3');
    await save();

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(memberById(TOBIN_ID)?.groups).toEqual(['group-3']);
  });

  it('refuses a person already on the team and keeps their groups', async () => {
    renderForm();
    await pick(dax);
    await tick('Group 1');
    await save();

    await waitFor(() => expect(screen.getByTestId('team-save-button')).toBeEnabled());
    expect(onDone).not.toHaveBeenCalled();
    expect(memberById('user-4')?.groups).toEqual(['group-2']);
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

  it('keeps the picked person and groups when the add fails', async () => {
    failWrites();
    await renderWithTobinPicked();
    await tick('Group 3');
    await save();

    await waitFor(() => expect(screen.getByTestId('team-save-button')).toBeEnabled());
    expect(onDone).not.toHaveBeenCalled();
    expect(checkbox('Group 3')).toBeChecked();
    expect(memberById(TOBIN_ID)).toBeUndefined();
  });

  it('changes nothing on cancel', async () => {
    await renderWithTobinPicked();
    await clickTestId('team-cancel-button');
    expect(onDone).toHaveBeenCalled();
    expect(memberById(TOBIN_ID)).toBeUndefined();
  });
});
