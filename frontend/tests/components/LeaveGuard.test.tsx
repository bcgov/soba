import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import en from '@/dictionaries/en.json';
import { LeaveGuard } from '@/src/components/LeaveGuard';
import { requestLeave } from '@/src/shared/hooks/useLeaveGuard';

vi.mock('@/app/[lang]/Providers', async () => {
  const dict = { ...(await import('@/dictionaries/en.json')).default, locale: 'en' };
  return { useDictionary: () => dict };
});

/** A button that leaves the page the way a router push does. */
function ExportButton({ go }: Readonly<{ go: () => void }>) {
  return (
    <button type="button" onClick={() => requestLeave(go)}>
      Export
    </button>
  );
}

const leaveTitle = en.general.unsavedChanges.title;

describe('LeaveGuard', () => {
  it('lets the leave go at once with nothing unsaved', async () => {
    const go = vi.fn();
    render(
      <>
        <LeaveGuard active={false} />
        <ExportButton go={go} />
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(go).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(leaveTitle)).not.toBeInTheDocument();
  });

  it('asks first with unsaved changes, and stays when told to', async () => {
    const go = vi.fn();
    render(
      <>
        <LeaveGuard active />
        <ExportButton go={go} />
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByText(leaveTitle)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('confirm-modal-cancel'));

    expect(go).not.toHaveBeenCalled();
    expect(screen.queryByText(leaveTitle)).not.toBeInTheDocument();
  });

  it('goes once the loss is confirmed', async () => {
    const go = vi.fn();
    render(
      <>
        <LeaveGuard active />
        <ExportButton go={go} />
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    await userEvent.click(await screen.findByTestId('confirm-modal-confirm'));

    expect(go).toHaveBeenCalledTimes(1);
  });
});
