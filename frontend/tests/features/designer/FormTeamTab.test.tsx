import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<unknown>('next/navigation');
  return {
    ...(actual as Record<string, unknown>),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/en/build/f1',
    useSearchParams: () => new URLSearchParams(''),
  };
});

import makeStore from '@/lib/store';
import FormTeamTab from '@/src/features/designer/ui/FormTeamTab';
import { resetFormTeam } from '@/src/features/designer/data/useFormTeam';

const click = async (testId: string) => {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
  });
};

describe('FormTeamTab', () => {
  beforeEach(() => {
    failWrites.on = false;
    act(() => resetFormTeam());
  });

  const renderTab = () =>
    render(
      <Provider store={makeStore()}>
        <FormTeamTab dict={dict} />
      </Provider>,
    );

  it('lists each member with their groups', () => {
    renderTab();
    expect(screen.getByTestId('team-list')).toHaveTextContent('Dax Halloran (sample)');
    expect(screen.getByTestId('team-list')).toHaveTextContent('dax.halloran@example.gov.bc.ca');
    expect(screen.getByTestId('user-4-group-2-tag')).toBeInTheDocument();
    expect(screen.queryByTestId('user-4-group-1-tag')).toBeNull();
  });

  it('says the team is sample data, on the list and on the form', async () => {
    renderTab();
    expect(screen.getByTestId('team-sample-notice')).toHaveTextContent('sample data');
    await click('team-add-button');
    expect(screen.getByTestId('team-sample-notice')).toBeInTheDocument();
  });

  it('opens the add form and comes back on cancel', async () => {
    renderTab();
    await click('team-add-button');
    expect(screen.getByTestId('team-member-form')).toHaveTextContent('1. Search for a user:');
    expect(screen.queryByTestId('team-list')).toBeNull();

    await click('team-cancel-button');
    expect(screen.getByTestId('team-list')).toBeInTheDocument();
  });

  it('opens the edit form with the member and their groups', async () => {
    renderTab();
    await click('user-4-edit-link');
    const form = screen.getByTestId('team-member-form');
    expect(form).toHaveTextContent('Edit Team Member');
    expect(form).toHaveTextContent('Dax Halloran (sample)');
    expect(form).not.toHaveTextContent('1. Search for a user:');
    expect(screen.getByRole('checkbox', { name: 'Group 2' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Group 1' })).not.toBeChecked();
  });

  it('keeps the member when the remove is cancelled', async () => {
    renderTab();
    await click('user-4-remove-link');
    expect(await screen.findByTestId('confirm-modal-message')).toHaveTextContent(
      'Dax Halloran (sample) will lose access to this form.',
    );
    await click('confirm-modal-cancel');

    await waitFor(() => expect(screen.queryByTestId('confirm-modal-message')).toBeNull());
    expect(screen.getByTestId('user-4-edit-link')).toBeInTheDocument();
  });

  it('removes the member once confirmed', async () => {
    renderTab();
    await click('user-4-remove-link');
    await screen.findByTestId('confirm-modal-message');
    await click('confirm-modal-confirm');

    await waitFor(() => expect(screen.queryByTestId('user-4-edit-link')).toBeNull());
    expect(screen.getByTestId('user-1-edit-link')).toBeInTheDocument();
  });

  it('keeps the member when the remove fails', async () => {
    failWrites.on = true;
    renderTab();
    await click('user-4-remove-link');
    await screen.findByTestId('confirm-modal-message');
    await click('confirm-modal-confirm');

    await waitFor(() => expect(screen.queryByTestId('confirm-modal-message')).toBeNull());
    expect(screen.getByTestId('user-4-edit-link')).toBeInTheDocument();
  });
});
