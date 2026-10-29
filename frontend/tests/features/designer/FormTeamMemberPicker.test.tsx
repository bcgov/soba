import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dict from '@/dictionaries/en.json';
import { FormTeamMemberPicker } from '@/src/features/designer/ui/FormTeamMemberPicker';
import { useFormTeamCandidates } from '@/src/features/designer/data/useFormTeam';

vi.mock('@/src/features/designer/data/useFormTeam', () => ({ useFormTeamCandidates: vi.fn() }));
const member = {
  id: 'user-1',
  membershipId: 'membership-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
};
const onSelect = vi.fn();
const renderPicker = () =>
  render(<FormTeamMemberPicker dict={dict} formId="form-1" onSelect={onSelect} />);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useFormTeamCandidates).mockReturnValue({
    members: [member],
    error: null,
    isLoading: false,
    truncated: false,
  });
});

describe('workspace member picker', () => {
  it('selects an existing membership and clears selection when the search changes', async () => {
    const user = userEvent.setup();
    renderPicker();
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.click(await screen.findByRole('option', { name: /Jane Doe/ }));
    expect(onSelect).toHaveBeenLastCalledWith(member);
    expect(screen.getByRole('status')).toHaveTextContent('Jane Doe');
    await user.clear(input);
    expect(onSelect).toHaveBeenLastCalledWith(null);
    await user.type(input, 'Marc');
    expect(useFormTeamCandidates).toHaveBeenLastCalledWith('form-1', 'Marc');
  });

  it('shows an empty state when no available workspace members match', () => {
    vi.mocked(useFormTeamCandidates).mockReturnValue({
      members: [],
      error: null,
      isLoading: false,
      truncated: false,
    });
    renderPicker();
    expect(screen.getByRole('status')).toHaveTextContent(dict.team.workspaceMembersEmpty);
  });

  it('shows a load failure and no selectable results', () => {
    vi.mocked(useFormTeamCandidates).mockReturnValue({
      members: [],
      error: { kind: 'forbidden', cause: new Error() },
      isLoading: false,
      truncated: false,
    });
    renderPicker();
    expect(screen.getByRole('alert')).toHaveTextContent(dict.team.workspaceMembersError);
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('explains how to refine a truncated list', () => {
    vi.mocked(useFormTeamCandidates).mockReturnValue({
      members: [member],
      error: null,
      isLoading: false,
      truncated: true,
    });
    renderPicker();
    expect(screen.getByRole('status')).toHaveTextContent(dict.team.workspaceMembersTruncated);
  });
});
