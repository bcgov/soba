import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    general: {
      cancel: 'Cancel',
      loading: 'Loading...',
      sessionExpired: 'Session ended.',
      noAccess: 'No access.',
    },
    apiErrors: { render_failed: 'Could not print from this template.' },
    dataTable: {},
    modal: { dialogActions: 'Dialog actions' },
    form: {
      templates: {
        fileLabel: 'Template File',
        acceptedTypes: 'Accepted file types: {types}.',
        uploadWrongType: 'Wrong type.',
        loadError: 'Failed to load templates.',
        print: {
          button: 'Print',
          modalTitle: 'Print Submission',
          browserTab: 'Browser Print',
          templateTab: 'Template Print',
          print: 'Print',
          printing: 'Printing...',
          sourceLabel: 'Template',
          uploadOption: 'Upload CDOGS template',
          defaultOption: 'Use default CDOGS template',
          fileNameColumn: 'File Name',
          uploadDateColumn: 'Upload Date',
          failed: 'Failed to generate the document.',
        },
      },
    },
  }),
}));

const mocks = vi.hoisted(() => ({ saveBlob: vi.fn() }));
vi.mock('@/src/features/templates/data/saveBlob', () => ({ saveBlob: mocks.saveBlob }));
vi.mock('@/src/shared/api/useDataErrorNotice', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/shared/api/useDataErrorNotice')>()),
  useDataErrorNotice: () => vi.fn(),
}));

import { ApiError } from '@/src/shared/api/sobaHelpers';
import type {
  StaffPrintTemplate,
  SubmissionPrint,
} from '@/src/features/templates/data/useSubmissionPrint';
import { PrintSubmissionButton } from '@/src/features/templates/ui/PrintSubmissionButton';

const pdf = new Blob(['doc'], { type: 'application/pdf' });
const OPTIONS = { convertTo: 'pdf', reportName: 'Receipt ABC123' };
const RECEIPT: StaffPrintTemplate = {
  id: 'tpl-1',
  name: 'Receipt',
  filename: 'receipt.docx',
  createdAt: '2026-01-02T03:04:05.000Z',
};

const printTemplate = vi.fn();
const printUploaded = vi.fn();

async function openTemplateTab(template: StaffPrintTemplate | null) {
  const print: SubmissionPrint = {
    choice: 'options',
    printTemplate,
    staff: { template, error: null, printUploaded },
  };
  render(<PrintSubmissionButton print={print} baseName="Receipt ABC123" />);
  fireEvent.click(screen.getByTestId('print-submission-button'));
  fireEvent.click(await screen.findByRole('tab', { name: 'Template Print' }));
}

const pickFile = (file: File) =>
  fireEvent.change(screen.getByTestId('print-template-file-input'), { target: { files: [file] } });

const printEnabled = () =>
  waitFor(() =>
    expect(screen.getByTestId('print-submission-print').hasAttribute('disabled')).toBe(false),
  );

describe('template print tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    printTemplate.mockResolvedValue(pdf);
    printUploaded.mockResolvedValue(pdf);
  });

  describe('without a template on the form version', () => {
    it('offers only the upload option and holds Print until a file is chosen', async () => {
      await openTemplateTab(null);
      expect(screen.getByTestId('print-template-source-upload')).toBeTruthy();
      expect(screen.queryByTestId('print-template-source-default')).toBeNull();
      expect(screen.getByTestId('print-submission-print').hasAttribute('disabled')).toBe(true);

      pickFile(new File(['x'], 'mine.docx'));
      await printEnabled();
    });

    it('sends the chosen file and saves a PDF named for the submission', async () => {
      await openTemplateTab(null);
      const file = new File(['x'], 'mine.docx');
      pickFile(file);
      await printEnabled();
      fireEvent.click(screen.getByTestId('print-submission-print'));

      await waitFor(() => expect(mocks.saveBlob).toHaveBeenCalledWith(pdf, 'Receipt ABC123.pdf'));
      expect(printUploaded).toHaveBeenCalledWith(file, OPTIONS);
      expect(printTemplate).not.toHaveBeenCalled();
    });

    it('refuses a file type the template does not accept', async () => {
      await openTemplateTab(null);
      pickFile(new File(['x'], 'mine.pdf'));
      expect(await screen.findByText('Wrong type.')).toBeTruthy();
      expect(screen.getByTestId('print-submission-print').hasAttribute('disabled')).toBe(true);
    });

    it('shows the message for a refused render', async () => {
      printUploaded.mockRejectedValue(new ApiError('nope', 422, 'render_failed'));
      await openTemplateTab(null);
      pickFile(new File(['x'], 'mine.docx'));
      await printEnabled();
      fireEvent.click(screen.getByTestId('print-submission-print'));

      expect(await screen.findByTestId('print-submission-error')).toBeTruthy();
      expect(screen.getByText('Could not print from this template.')).toBeTruthy();
      expect(mocks.saveBlob).not.toHaveBeenCalled();
    });
  });

  describe('with a template on the form version', () => {
    it('defaults to the stored template and lists its file name and date', async () => {
      await openTemplateTab(RECEIPT);
      expect(screen.getByTestId('print-template-source-default')).toBeTruthy();
      expect(screen.getByTestId('print-template-source-upload')).toBeTruthy();
      expect(screen.getByText('receipt.docx')).toBeTruthy();
      expect(screen.getByTestId('print-submission-print').hasAttribute('disabled')).toBe(false);
    });

    it('prints with the stored template, without uploading', async () => {
      await openTemplateTab(RECEIPT);
      fireEvent.click(screen.getByTestId('print-submission-print'));

      await waitFor(() => expect(mocks.saveBlob).toHaveBeenCalledWith(pdf, 'Receipt ABC123.pdf'));
      expect(printTemplate).toHaveBeenCalledWith(OPTIONS);
      expect(printUploaded).not.toHaveBeenCalled();
    });

    it('switches to the upload option', async () => {
      await openTemplateTab(RECEIPT);
      fireEvent.click(screen.getByLabelText('Upload CDOGS template'));
      expect(await screen.findByTestId('print-template-file-input')).toBeTruthy();
      expect(screen.getByTestId('print-submission-print').hasAttribute('disabled')).toBe(true);
    });
  });
});
