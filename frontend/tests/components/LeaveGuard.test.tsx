import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/dictionaries/en.json';
import { LeaveGuard, useGuardedPush } from '@/src/components/LeaveGuard';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/app/[lang]/Providers', async () => {
  const dict = { ...(await import('@/dictionaries/en.json')).default, locale: 'en' };
  return { useDictionary: () => dict };
});

function ExportButton() {
  const guardedPush = useGuardedPush();
  return (
    <button type="button" onClick={() => guardedPush('/en/exports')}>
      Export
    </button>
  );
}

const leaveTitle = en.general.unsavedChanges.title;

beforeEach(() => push.mockClear());

describe('useGuardedPush', () => {
  it('pushes at once outside a guard', async () => {
    render(<ExportButton />);

    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(push).toHaveBeenCalledWith('/en/exports');
  });

  it('pushes at once inside a guard with nothing unsaved', async () => {
    render(
      <LeaveGuard active={false}>
        <ExportButton />
      </LeaveGuard>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(push).toHaveBeenCalledWith('/en/exports');
    expect(screen.queryByText(leaveTitle)).not.toBeInTheDocument();
  });

  it('asks first inside a guard with unsaved changes, and goes once confirmed', async () => {
    render(
      <LeaveGuard active>
        <ExportButton />
      </LeaveGuard>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(push).not.toHaveBeenCalled();
    expect(await screen.findByText(leaveTitle)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('confirm-modal-confirm'));
    expect(push).toHaveBeenCalledWith('/en/exports');
  });
});
