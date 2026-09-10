import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormSettingsDrawer from '@/src/features/designer/ui/FormSettingsDrawer';
import type { Dictionary } from '@/src/types/plugins';

const { mockUpdateSobaForm, mockRefreshForm, mockAddNotification } = vi.hoisted(() => ({
  mockUpdateSobaForm: vi.fn(),
  mockRefreshForm: vi.fn(),
  mockAddNotification: vi.fn(),
}));

vi.mock('@/src/shared/api/sobaApiDesign', () => ({
  updateSobaForm: (...args: unknown[]) => mockUpdateSobaForm(...args),
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ token: 'mock-token' }),
}));

vi.mock('@/src/features/designer/useForm', () => ({
  useForm: () => ({
    form: { description: 'Initial description' },
    refreshForm: mockRefreshForm,
  }),
}));

vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: mockAddNotification,
  }),
}));

const mockDict = {
  form: {
    save: "Save",
    settings: {
      formSettingsDrawerLabel: 'Form Settings',
      formSettingsDrawerSaveSuccessMessage: 'Changes saved successfully.',
      formSettingsDrawerSaveErrorMessage: 'Failed to save changes. Please try again.',
    },
    descriptionLabel: 'Description',
  },
  general: {
    cancel: "Cancel"
  }
} as unknown as Dictionary;

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => mockDict,
}));

describe('FormSettingsDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderDrawer() {
    return render(<FormSettingsDrawer dict={mockDict} drawerName="test-drawer" formId="f1" />);
  }

  it('renders correctly with initial description', () => {
    renderDrawer();

    // Check if the accordion label is present
    expect(screen.getByText('Form Settings')).toBeInTheDocument();

    // Check if textarea has initial value
    const textarea = screen.getByTestId('form-settings-description').querySelector('textarea')!;
    expect(textarea).toHaveValue('Initial description');
  });

  it('updates description when typing', async () => {
    renderDrawer();

    const textarea = screen.getByTestId('form-settings-description').querySelector('textarea')!;
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'New description');

    expect(textarea).toHaveValue('New description');
  });

  it('saves changes successfully', async () => {
    mockUpdateSobaForm.mockResolvedValueOnce({});
    renderDrawer();

    const textarea = screen.getByTestId('form-settings-description').querySelector('textarea')!;
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'New description');

    const saveButton = screen.getByTestId('form-settings-test-drawer-save');
    await userEvent.click(saveButton);

    expect(mockUpdateSobaForm).toHaveBeenCalledWith('mock-token', 'f1', {
      description: 'New description',
    });

    expect(mockRefreshForm).toHaveBeenCalled();
    expect(mockAddNotification).toHaveBeenCalledWith({
      type: 'success',
      text: 'Changes saved successfully.',
    });
  });

  it('shows error notification on save failure', async () => {
    mockUpdateSobaForm.mockRejectedValueOnce(new Error('Save failed'));
    renderDrawer();

    const textarea = screen.getByTestId('form-settings-description').querySelector('textarea')!;
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'New description');

    const saveButton = screen.getByTestId('form-settings-test-drawer-save');
    await userEvent.click(saveButton);

    expect(mockUpdateSobaForm).toHaveBeenCalledWith('mock-token', 'f1', {
      description: 'New description',
    });

    expect(mockRefreshForm).not.toHaveBeenCalled();
    expect(mockAddNotification).toHaveBeenCalledWith({
      type: 'error',
      text: 'Failed to save changes. Please try again.',
    });
  });

  it('cancels changes and reverts to initial description', async () => {
    renderDrawer();

    const textarea = screen.getByTestId('form-settings-description').querySelector('textarea')!;
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Changed description');
    expect(textarea).toHaveValue('Changed description');

    const cancelButton = screen.getByTestId('form-settings-test-drawer-cancel');
    await userEvent.click(cancelButton);

    expect(textarea).toHaveValue('Initial description');
    expect(mockUpdateSobaForm).not.toHaveBeenCalled();
  });
});
