import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SubmissionReview } from '@/src/types/submissionReview';

vi.mock('@/app/[lang]/Providers', async () => {
  const dict = { ...(await import('@/dictionaries/en.json')).default, locale: 'en' };
  return { useDictionary: () => dict };
});

const { currentUser } = vi.hoisted(() => ({
  currentUser: { displayName: 'Rev Iewer' as string | null },
}));
vi.mock('@/src/shared/api/useCurrentUser', () => ({ useCurrentUser: () => currentUser }));

import { SubmissionStatusPanel } from '@/src/features/designer/ui/SubmissionStatusPanel';

const REVIEW: SubmissionReview = {
  assignees: ['Grace Hopper'],
  statusHistory: [
    {
      id: 's2',
      status: 'ASSIGNED',
      assignee: 'Grace Hopper',
      changedAt: '2026-01-03T03:04:05Z',
      updatedBy: 'Ada Lovelace',
    },
    {
      id: 's1',
      status: 'SUBMITTED',
      assignee: null,
      changedAt: '2026-01-02T03:04:05Z',
      updatedBy: 'Ada Lovelace',
    },
  ],
  notes: [],
  editHistory: [],
};

const onUpdate = vi.fn();

// DS Select is a button plus a popup listbox, not a native <select>.
async function choose(user: ReturnType<typeof userEvent.setup>, testId: string, option: string) {
  await user.click(within(screen.getByTestId(testId)).getByRole('button'));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('SubmissionStatusPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.displayName = 'Rev Iewer';
    onUpdate.mockResolvedValue(true);
  });

  it('shows the latest status change as the current status and assignee', () => {
    render(<SubmissionStatusPanel review={REVIEW} onUpdate={onUpdate} />);

    expect(screen.getByTestId('submission-status-current')).toHaveTextContent(
      'Current Status: Assigned',
    );
    expect(screen.getByTestId('submission-status-assignee')).toHaveTextContent('Grace Hopper');
    expect(screen.getByTestId('submission-status-update')).toBeDisabled();
  });

  it('sends a status that needs no assignee as soon as it is chosen', async () => {
    const user = userEvent.setup();
    render(<SubmissionStatusPanel review={REVIEW} onUpdate={onUpdate} />);

    await choose(user, 'submission-status-select', 'Completed');
    expect(screen.queryByTestId('submission-status-assignee-select')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('submission-status-update'));

    expect(onUpdate).toHaveBeenCalledWith({ status: 'COMPLETED', assignee: null });
  });

  it('holds an assignment until someone is picked', async () => {
    const user = userEvent.setup();
    render(<SubmissionStatusPanel review={REVIEW} onUpdate={onUpdate} />);

    await choose(user, 'submission-status-select', 'Assigned');
    expect(screen.getByTestId('submission-status-update')).toBeDisabled();

    await choose(user, 'submission-status-assignee-select', 'Grace Hopper');
    await user.click(screen.getByTestId('submission-status-update'));

    expect(onUpdate).toHaveBeenCalledWith({ status: 'ASSIGNED', assignee: 'Grace Hopper' });
  });

  it('assigns to the signed-in user, who need not be on the list', async () => {
    const user = userEvent.setup();
    render(<SubmissionStatusPanel review={REVIEW} onUpdate={onUpdate} />);

    await choose(user, 'submission-status-select', 'Assigned');
    await user.click(screen.getByTestId('submission-status-assign-me'));
    await user.click(screen.getByTestId('submission-status-update'));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ assignee: 'Rev Iewer' }));
  });

  it('offers no assign-to-me link when the user has no name to assign', async () => {
    currentUser.displayName = null;
    const user = userEvent.setup();
    render(<SubmissionStatusPanel review={REVIEW} onUpdate={onUpdate} />);

    await choose(user, 'submission-status-select', 'Assigned');

    expect(screen.queryByTestId('submission-status-assign-me')).not.toBeInTheDocument();
  });

  it('clears the controls once the update has gone through', async () => {
    const user = userEvent.setup();
    render(<SubmissionStatusPanel review={REVIEW} onUpdate={onUpdate} />);

    await choose(user, 'submission-status-select', 'Assigned');
    await user.click(screen.getByTestId('submission-status-assign-me'));
    await user.click(screen.getByTestId('submission-status-update'));

    expect(screen.queryByTestId('submission-status-assignee-select')).not.toBeInTheDocument();
    expect(screen.getByTestId('submission-status-update')).toBeDisabled();
  });

  it('keeps what was chosen when the update does not save', async () => {
    onUpdate.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<SubmissionStatusPanel review={REVIEW} onUpdate={onUpdate} />);

    await choose(user, 'submission-status-select', 'Assigned');
    await user.click(screen.getByTestId('submission-status-assign-me'));
    await user.click(screen.getByTestId('submission-status-update'));

    expect(onUpdate).toHaveBeenCalled();
    expect(screen.getByTestId('submission-status-assignee-select')).toHaveTextContent('Rev Iewer');
    expect(screen.getByTestId('submission-status-update')).toBeEnabled();
  });

  it('drops the assignee when the status is switched away from Assigned', async () => {
    const user = userEvent.setup();
    render(<SubmissionStatusPanel review={REVIEW} onUpdate={onUpdate} />);

    await choose(user, 'submission-status-select', 'Assigned');
    await user.click(screen.getByTestId('submission-status-assign-me'));
    await choose(user, 'submission-status-select', 'Revising');
    await user.click(screen.getByTestId('submission-status-update'));

    expect(onUpdate).toHaveBeenCalledWith({ status: 'REVISING', assignee: null });
  });

  it('marks the status as required', () => {
    render(<SubmissionStatusPanel review={REVIEW} onUpdate={onUpdate} />);

    expect(screen.getByTestId('submission-status-select')).toHaveTextContent('(required)');
  });

  it('lists every status change in the history, newest first', async () => {
    const user = userEvent.setup();
    render(<SubmissionStatusPanel review={REVIEW} onUpdate={onUpdate} />);

    await user.click(screen.getByTestId('submission-status-history'));

    // A status tag carries rows of its own, so the order is read from the text.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('StatusDate Status ChangedAssigneeUpdated By');
    expect(dialog).toHaveTextContent(/Assigned.*Grace Hopper.*Submitted/);
  });
});
