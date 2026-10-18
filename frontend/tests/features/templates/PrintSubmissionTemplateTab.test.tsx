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
    dataTable: {},
    modal: { dialogActions: 'Dialog actions' },
    form: {
      templates: {
        fileLabel: 'Template File',
        acceptedTypes: 'Accepted file types: {types}.',
        uploadWrongType: 'Wrong type.',
        uploadTooLarge: 'Too large.',
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
          unprocessable: 'Could not generate from this template.',
        },
      },
    },
  }),
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({ useKeycloak: () => ({ token: 'tok' }) }));

const templatesState = vi.hoisted(() => ({
  templates: [] as { id: string; name: string; filename: string; createdAt: string }[],
}));
vi.mock('@/src/features/templates/data/useSubmissionTemplates', () => ({
  useSubmissionTemplates: () => ({
    templates: templatesState.templates,
    isLoading: false,
    error: null,
  }),
}));

const api = vi.hoisted(() => ({
  printWithStoredTemplate: vi.fn(),
  printWithUploadedTemplate: vi.fn(),
  saveBlob: vi.fn(),
}));
vi.mock('@/src/features/templates/data/printApi', () => ({
  printWithStoredTemplate: api.printWithStoredTemplate,
  printWithUploadedTemplate: api.printWithUploadedTemplate,
}));
vi.mock('@/src/features/templates/data/saveBlob', () => ({ saveBlob: api.saveBlob }));

import { ApiError } from '@/src/shared/api/sobaHelpers';
import { PrintSubmissionButton } from '@/src/features/templates/ui/PrintSubmissionButton';

const blob = new Blob(['doc']);

async function openTemplateTab() {
  render(<PrintSubmissionButton submissionId="sub-1" />);
  fireEvent.click(screen.getByTestId('print-submission-button'));
  fireEvent.click(await screen.findByRole('tab', { name: 'Template Print' }));
}

const pickFile = (file: File) =>
  fireEvent.change(screen.getByTestId('print-template-file-input'), { target: { files: [file] } });

describe('template print tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    templatesState.templates = [];
    api.printWithUploadedTemplate.mockResolvedValue(blob);
    api.printWithStoredTemplate.mockResolvedValue(blob);
  });

  describe('without a template on the form version', () => {
    it('offers only the upload option and holds Print until a file is chosen', async () => {
      await openTemplateTab();
      expect(screen.getByTestId('print-template-source-upload')).toBeTruthy();
      expect(screen.queryByTestId('print-template-source-default')).toBeNull();
      expect(screen.getByTestId('print-submission-print').hasAttribute('disabled')).toBe(true);

      pickFile(new File(['x'], 'mine.docx'));
      await waitFor(() =>
        expect(screen.getByTestId('print-submission-print').hasAttribute('disabled')).toBe(false),
      );
    });

    it('sends the chosen file and saves the document', async () => {
      await openTemplateTab();
      const file = new File(['x'], 'mine.docx');
      pickFile(file);
      await waitFor(() =>
        expect(screen.getByTestId('print-submission-print').hasAttribute('disabled')).toBe(false),
      );
      fireEvent.click(screen.getByTestId('print-submission-print'));

      await waitFor(() => expect(api.saveBlob).toHaveBeenCalledWith(blob, 'mine.docx'));
      expect(api.printWithUploadedTemplate).toHaveBeenCalledWith('tok', 'sub-1', file);
      expect(api.printWithStoredTemplate).not.toHaveBeenCalled();
    });

    it('refuses a file type the template does not accept', async () => {
      await openTemplateTab();
      pickFile(new File(['x'], 'mine.pdf'));
      expect(await screen.findByText('Wrong type.')).toBeTruthy();
      expect(screen.getByTestId('print-submission-print').hasAttribute('disabled')).toBe(true);
    });

    it('shows a message when the render is refused', async () => {
      api.printWithUploadedTemplate.mockRejectedValue(new ApiError('nope', 422));
      await openTemplateTab();
      pickFile(new File(['x'], 'mine.docx'));
      await waitFor(() =>
        expect(screen.getByTestId('print-submission-print').hasAttribute('disabled')).toBe(false),
      );
      fireEvent.click(screen.getByTestId('print-submission-print'));

      expect(await screen.findByTestId('print-submission-error')).toBeTruthy();
      expect(screen.getByText('Could not generate from this template.')).toBeTruthy();
      expect(api.saveBlob).not.toHaveBeenCalled();
    });
  });

  describe('with a template on the form version', () => {
    beforeEach(() => {
      templatesState.templates = [
        {
          id: 'tpl-1',
          name: 'Receipt',
          filename: 'receipt.docx',
          createdAt: '2026-01-02T03:04:05.000Z',
        },
      ];
    });

    it('defaults to the stored template and lists its file name and date', async () => {
      await openTemplateTab();
      expect(screen.getByTestId('print-template-source-default')).toBeTruthy();
      expect(screen.getByTestId('print-template-source-upload')).toBeTruthy();
      expect(screen.getByText('File Name')).toBeTruthy();
      expect(screen.getByText('Upload Date')).toBeTruthy();
      expect(screen.getByText('receipt.docx')).toBeTruthy();
      expect(screen.getByTestId('print-submission-print').hasAttribute('disabled')).toBe(false);
    });

    it('prints with the stored template by id, without uploading', async () => {
      await openTemplateTab();
      fireEvent.click(screen.getByTestId('print-submission-print'));

      await waitFor(() => expect(api.saveBlob).toHaveBeenCalledWith(blob, 'receipt.docx'));
      expect(api.printWithStoredTemplate).toHaveBeenCalledWith('tok', 'sub-1', 'tpl-1');
      expect(api.printWithUploadedTemplate).not.toHaveBeenCalled();
    });

    it('switches to the upload option', async () => {
      await openTemplateTab();
      fireEvent.click(screen.getByLabelText('Upload CDOGS template'));
      expect(await screen.findByTestId('print-template-file-input')).toBeTruthy();
      expect(screen.getByTestId('print-submission-print').hasAttribute('disabled')).toBe(true);
    });
  });
});
