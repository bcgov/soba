import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    general: { cancel: 'Cancel' },
    modal: { dialogActions: 'Dialog actions' },
    form: {
      templates: {
        print: {
          button: 'Print',
          modalTitle: 'Print Submission',
          browserTab: 'Browser Print',
          templateTab: 'Template Print',
          print: 'Print',
        },
      },
    },
  }),
}));

import { PrintSubmissionButton } from '@/src/features/templates/ui/PrintSubmissionButton';

describe('PrintSubmissionButton', () => {
  beforeEach(() => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  it('opens the modal with browser and template tabs', async () => {
    render(<PrintSubmissionButton />);
    expect(screen.queryByTestId('print-submission-tabs')).toBeNull();

    fireEvent.click(screen.getByTestId('print-submission-button'));

    expect(await screen.findByRole('tab', { name: 'Browser Print' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Template Print' })).toBeTruthy();
    expect(screen.getByTestId('print-submission-print')).toBeTruthy();
    expect(screen.getByTestId('print-submission-cancel')).toBeTruthy();
  });

  it('closes on cancel without printing', async () => {
    render(<PrintSubmissionButton />);
    fireEvent.click(screen.getByTestId('print-submission-button'));
    fireEvent.click(await screen.findByTestId('print-submission-cancel'));

    await waitFor(() => expect(screen.queryByTestId('print-submission-tabs')).toBeNull());
    expect(window.print).not.toHaveBeenCalled();
  });

  it('closes the modal and opens the browser print', async () => {
    render(<PrintSubmissionButton />);
    fireEvent.click(screen.getByTestId('print-submission-button'));
    fireEvent.click(await screen.findByTestId('print-submission-print'));

    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('print-submission-tabs')).toBeNull();
  });
});
