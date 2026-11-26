import { Provider } from 'react-redux';
import makeStore from '@/lib/store';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormSettingsDrawer from '@/src/features/form-settings/form/FormSettingsDrawer';
import type { Dictionary } from '@/src/types/dictionary';
import { ApiError } from '@/src/shared/api/sobaHelpers';

const { mockFormUpdate, mockAddNotification, loaded } = vi.hoisted(() => ({
  mockFormUpdate: vi.fn(),
  mockAddNotification: vi.fn(),
  // Stands in for the shared SWR key: a write anywhere changes what every reader sees.
  loaded: { name: 'Initial name', description: 'Initial description' },
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ token: 'mock-token' }),
}));

vi.mock('@/src/features/designer/data/useForm', () => ({
  useForm: () => ({ form: loaded }),
  useFormWriter: () => ({ update: mockFormUpdate }),
}));

vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: mockAddNotification,
  }),
}));

// The live name check has its own tests; here it answers whatever a test sets.
const { nameCheck } = vi.hoisted(() => ({
  nameCheck: {
    calls: [] as unknown[][],
    revalidate: () => undefined as void,
    result: {} as Record<string, unknown>,
  },
}));
vi.mock('@/src/features/designer/data/useFormNameCheck', () => ({
  useFormRenameCheck: (...args: unknown[]) => {
    nameCheck.calls.push(args);
    return { ...nameCheck.result, revalidate: nameCheck.revalidate };
  },
}));
const idleNameCheck = {
  status: null,
  blocksSave: false,
  description: undefined,
  errorMessage: undefined,
  announcement: '',
};

const mockDict = {
  form: {
    save: 'Save',
    settings: {
      formSettingsDrawerLabel: 'Form Settings',
      formSettingsDrawerSaveSuccessMessage: 'Changes saved successfully.',
      formSettingsDrawerSaveErrorMessage: 'Failed to save changes. Please try again.',
    },
    descriptionLabel: 'Description',
    nameLabel: 'Form Name',
    noFormName: 'Form name is required',
  },
  general: {
    cancel: 'Cancel',
  },
} as unknown as Dictionary;

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => mockDict,
}));

describe('FormSettingsDrawer', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    vi.clearAllMocks();
    nameCheck.calls = [];
    nameCheck.result = { ...idleNameCheck };
    nameCheck.revalidate = vi.fn();
    loaded.name = 'Initial name';
    loaded.description = 'Initial description';
    store = makeStore();
  });

  function renderDrawer() {
    return render(
      <Provider store={store}>
        <FormSettingsDrawer dict={mockDict} drawerName="test-drawer" formId="f1" />
      </Provider>,
    );
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
    mockFormUpdate.mockResolvedValueOnce({});
    renderDrawer();

    const textarea = screen.getByTestId('form-settings-description').querySelector('textarea')!;
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'New description');

    const saveButton = screen.getByTestId('form-settings-test-drawer-save');
    await userEvent.click(saveButton);

    expect(mockFormUpdate).toHaveBeenCalledWith('mock-token', {
      description: 'New description',
    });

    expect(mockAddNotification).toHaveBeenCalledWith({
      type: 'success',
      text: 'Changes saved successfully.',
    });
  });

  // Only the edited fields are sent, so a save never writes back a value read from somewhere else.
  it('sends only the name when only the name is edited', async () => {
    mockFormUpdate.mockResolvedValueOnce({});
    renderDrawer();

    const input = screen.getByTestId('form-settings-name').querySelector('input')!;
    await userEvent.clear(input);
    await userEvent.type(input, '  Renamed  ');
    await userEvent.click(screen.getByTestId('form-settings-test-drawer-save'));

    expect(mockFormUpdate).toHaveBeenCalledWith('mock-token', { name: 'Renamed' });
    expect(mockAddNotification).toHaveBeenCalledWith({
      type: 'success',
      text: 'Changes saved successfully.',
    });
  });

  it('sends both fields when both are edited', async () => {
    mockFormUpdate.mockResolvedValueOnce({});
    renderDrawer();

    const input = screen.getByTestId('form-settings-name').querySelector('input')!;
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed');
    const textarea = screen.getByTestId('form-settings-description').querySelector('textarea')!;
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'New description');
    await userEvent.click(screen.getByTestId('form-settings-test-drawer-save'));

    expect(mockFormUpdate).toHaveBeenCalledWith('mock-token', {
      name: 'Renamed',
      description: 'New description',
    });
  });

  it('disables Save until something is edited', async () => {
    renderDrawer();

    expect(screen.getByTestId('form-settings-test-drawer-save')).toBeDisabled();
    const input = screen.getByTestId('form-settings-name').querySelector('input')!;
    await userEvent.type(input, 'X');
    expect(screen.getByTestId('form-settings-test-drawer-save')).toBeEnabled();
  });

  // The name is a required field, so a blank one is reported on the field and never reaches the
  // backend, which rejects it with a generic error.
  it.each([
    ['empty', ''],
    ['blank', '   '],
  ])('reports a %s name on the field and saves nothing', async (_label, value) => {
    renderDrawer();

    const input = screen.getByTestId('form-settings-name').querySelector('input')!;
    await userEvent.clear(input);
    if (value) await userEvent.type(input, value);
    await userEvent.click(screen.getByTestId('form-settings-test-drawer-save'));

    expect(await screen.findByText('Form name is required')).toBeInTheDocument();
    expect(mockFormUpdate).not.toHaveBeenCalled();
  });

  it("checks the name typed against the form's own", async () => {
    renderDrawer();
    const input = screen.getByTestId('form-settings-name').querySelector('input')!;
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed');

    expect(nameCheck.calls.at(-1)?.slice(0, 3)).toEqual(['Renamed', 'f1', 'Initial name']);
  });

  it('says a free name is available', () => {
    nameCheck.result = {
      ...idleNameCheck,
      status: 'available',
      description: 'Available ✓',
      announcement: 'Available',
    };
    renderDrawer();

    expect(screen.getByTestId('form-settings-name')).toHaveTextContent('Available ✓');
    expect(screen.getByTestId('form-settings-name-status')).toHaveTextContent('Available');
  });

  it('marks a taken name on the field, and saves nothing', async () => {
    nameCheck.result = {
      ...idleNameCheck,
      status: 'unavailable',
      blocksSave: true,
      errorMessage: 'Unavailable ✕',
      announcement: 'Unavailable',
    };
    renderDrawer();
    const input = screen.getByTestId('form-settings-name').querySelector('input')!;
    await userEvent.type(input, ' 2');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('form-settings-name')).toHaveTextContent('Unavailable ✕');
    expect(screen.getByTestId('form-settings-name-status')).toHaveTextContent('Unavailable');
    expect(screen.getByTestId('form-settings-test-drawer-save')).toBeDisabled();
  });

  it('waits for the check before saving', async () => {
    nameCheck.result = { ...idleNameCheck, status: 'checking', blocksSave: true };
    renderDrawer();
    const input = screen.getByTestId('form-settings-name').querySelector('input')!;
    await userEvent.type(input, ' 2');

    expect(screen.getByTestId('form-settings-test-drawer-save')).toBeDisabled();
  });

  it('checks the name again when a rename is refused over it', async () => {
    mockFormUpdate.mockRejectedValueOnce(new ApiError('A form with this name exists', 409));
    renderDrawer();
    const input = screen.getByTestId('form-settings-name').querySelector('input')!;
    await userEvent.type(input, ' 2');
    await userEvent.click(screen.getByTestId('form-settings-test-drawer-save'));

    expect(nameCheck.revalidate).toHaveBeenCalled();
  });

  it('shows error notification on save failure', async () => {
    mockFormUpdate.mockRejectedValueOnce(new Error('Save failed'));
    renderDrawer();

    const textarea = screen.getByTestId('form-settings-description').querySelector('textarea')!;
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'New description');

    const saveButton = screen.getByTestId('form-settings-test-drawer-save');
    await userEvent.click(saveButton);

    expect(mockFormUpdate).toHaveBeenCalledWith('mock-token', {
      description: 'New description',
    });

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
    expect(mockFormUpdate).not.toHaveBeenCalled();
  });

  // The description is edited here and written from the designer's save, so a field left alone has
  // to follow the record rather than the copy this drawer was mounted with.
  it('shows a description written elsewhere when the field is untouched', () => {
    const { rerender } = renderDrawer();

    loaded.description = 'Written somewhere else';
    rerender(
      <Provider store={store}>
        <FormSettingsDrawer dict={mockDict} drawerName="test-drawer" formId="f1" />
      </Provider>,
    );

    const textarea = screen.getByTestId('form-settings-description').querySelector('textarea')!;
    expect(textarea).toHaveValue('Written somewhere else');
  });

  it('keeps an in-progress edit when the record changes underneath', async () => {
    const { rerender } = renderDrawer();

    const textarea = screen.getByTestId('form-settings-description').querySelector('textarea')!;
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Half typed');

    loaded.description = 'Written somewhere else';
    rerender(
      <Provider store={store}>
        <FormSettingsDrawer dict={mockDict} drawerName="test-drawer" formId="f1" />
      </Provider>,
    );

    expect(textarea).toHaveValue('Half typed');
  });
});
