import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormCreateContent } from '@/src/features/designer/ui/FormCreateContent';
import { ApiError } from '@/src/shared/api/sobaHelpers';

const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockRouterPush })),
  useParams: () => ({ lang: 'en' }),
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ token: 'mock-token' }),
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    form: {
      nameLabel: 'Form Name',
      noActiveWorkspaceError: 'Select a workspace before saving this form.',
      noFormName: 'Enter a form name.',
      saved: 'Form saved successfully.',
      saveError: 'Failed to save form.',
      versionConflict: 'Version conflict.',
      disclaimerRequired: 'Accept the workspace disclaimer before creating a form.',
      noActiveWorkspace: 'No active workspace.',
    },
    general: {
      cancel: 'Cancel',
      next: 'Next',
      lookupTruncated: 'Showing truncated.',
    },
    workspaces: {
      workspace: 'Workspace',
    },
  }),
}));

const mockAddNotification = vi.fn();
vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: mockAddNotification,
  }),
}));

const mockCreateSobaFormioForm = vi.fn();
const mockSaveFormVersionSchema = vi.fn();
vi.mock('@/src/shared/api/sobaApi', () => ({
  createSobaFormioForm: (...args: unknown[]) => mockCreateSobaFormioForm(...args),
  saveFormVersionSchema: (...args: unknown[]) => mockSaveFormVersionSchema(...args),
}));

vi.mock('@/src/shared/api/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('@/src/shared/api/useWorkspaces', () => ({
  useFormCreateWorkspaceOptions: vi.fn(),
}));

vi.mock('@/src/features/designer/data/useSubmitterAudience', () => ({
  useSubmitterAudience: vi.fn(),
}));

vi.mock('@/src/features/designer/ui/FormSubmitterAudience', () => ({
  FormSubmitterAudience: () => <div data-testid="form-submitter-audience" />,
}));

vi.mock('@/app/ui/WorkspaceSelector', () => ({
  WorkspaceSelector: ({
    selectedWorkspaceId,
    onChange,
    workspaces,
    label,
  }: {
    selectedWorkspaceId: string | null;
    onChange: (id: string) => void;
    workspaces: Array<{ id: string; name: string }>;
    label: string;
  }) => (
    <div>
      <label>{label}</label>
      <select
        data-testid="workspace-selector"
        value={selectedWorkspaceId || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select workspace</option>
        {workspaces.map((w: { id: string; name: string }) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </div>
  ),
}));

import type { Mock } from 'vitest';
import { useCurrentUser } from '@/src/shared/api/useCurrentUser';
import { useFormCreateWorkspaceOptions } from '@/src/shared/api/useWorkspaces';
import { useSubmitterAudience } from '@/src/features/designer/data/useSubmitterAudience';

describe('FormCreateContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useCurrentUser as Mock).mockReturnValue({
      data: { capabilities: { formCreate: 'allowed' } },
      loaded: true,
    });
    (useFormCreateWorkspaceOptions as Mock).mockReturnValue({
      workspaces: [
        { id: 'ws-1', name: 'Workspace 1', role: 'owner' },
        { id: 'ws-2', name: 'Workspace 2', role: 'editor' },
      ],
      truncated: false,
    });
    mockCreateSobaFormioForm.mockResolvedValue({
      id: 'form-123',
      formVersion: { id: 'v-1', versionNo: 1, state: 'draft' },
    });
    mockSaveFormVersionSchema.mockResolvedValue({});
    (useSubmitterAudience as Mock).mockReturnValue({
      view: {
        mode: 'none',
        idps: [],
        users: [],
        available: [{ code: 'azureidir', name: 'IDIR - MFA' }],
      },
      error: null,
    });
  });

  const renderComponent = () => render(<FormCreateContent onCancelPress={vi.fn()} />);

  const nameInput = () =>
    screen.getByTestId('form-name-modal').querySelector('input') as HTMLInputElement;

  it('renders form name input and workspace selector', () => {
    renderComponent();
    expect(screen.getByTestId('form-name-modal')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-selector')).toBeInTheDocument();
  });

  // The name is a required field, so a blank one is reported on the field and never reaches the
  // backend, which rejects it with a generic error.
  it.each([
    ['empty', ''],
    ['blank', '   '],
  ])('reports a %s form name on the field and does not create', async (_label, value) => {
    renderComponent();
    await userEvent.selectOptions(screen.getByTestId('workspace-selector'), 'ws-1');
    if (value) {
      await userEvent.type(nameInput(), value);
    }

    await userEvent.click(screen.getByTestId('save-create-form'));

    expect(await screen.findByText('Enter a form name.')).toBeInTheDocument();
    expect(mockCreateSobaFormioForm).not.toHaveBeenCalled();
  });

  it('shows notification if workspace is not selected on save', async () => {
    renderComponent();
    const saveButton = screen.getByTestId('save-create-form');

    await userEvent.type(nameInput(), 'My New Form');

    await userEvent.click(saveButton);
    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Select a workspace before saving this form.',
        type: 'error',
      }),
    );
  });

  it('creates form successfully and redirects', async () => {
    renderComponent();

    await userEvent.type(nameInput(), 'My New Form');

    // Select workspace
    const select = screen.getByTestId('workspace-selector');
    await userEvent.selectOptions(select, 'ws-1');

    const saveButton = screen.getByTestId('save-create-form');
    await userEvent.click(saveButton);

    expect(mockCreateSobaFormioForm).toHaveBeenCalledWith(
      'mock-token',
      { name: 'My New Form' },
      'ws-1',
    );
    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Form saved successfully.', type: 'success' }),
    );
    expect(mockRouterPush).toHaveBeenCalledWith('/en/build/form-123');
  });

  // A version with no schema answers a read with 404, which leaves the designer nothing to open.
  it('writes the empty schema to the version the form is created with', async () => {
    renderComponent();

    await userEvent.type(nameInput(), 'My New Form');
    await userEvent.selectOptions(screen.getByTestId('workspace-selector'), 'ws-1');
    await userEvent.click(screen.getByTestId('save-create-form'));

    expect(mockSaveFormVersionSchema).toHaveBeenCalledWith('mock-token', 'v-1', {
      components: [],
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/en/build/form-123');
  });

  it('sends the name without surrounding whitespace', async () => {
    renderComponent();

    await userEvent.type(nameInput(), '  My New Form  ');
    await userEvent.selectOptions(screen.getByTestId('workspace-selector'), 'ws-1');
    await userEvent.click(screen.getByTestId('save-create-form'));

    expect(mockCreateSobaFormioForm).toHaveBeenCalledWith(
      'mock-token',
      { name: 'My New Form' },
      'ws-1',
    );
  });

  // A 409 here means the name is taken or the disclaimer is unaccepted, so the backend's own
  // message is the useful one. Nothing in this dialog has versions to conflict over.
  it('reports the reason a conflicting create was refused', async () => {
    mockCreateSobaFormioForm.mockRejectedValue(
      new ApiError('A form with this name already exists in this workspace.', 409),
    );
    renderComponent();

    await userEvent.type(nameInput(), 'My New Form');
    await userEvent.selectOptions(screen.getByTestId('workspace-selector'), 'ws-1');
    await userEvent.click(screen.getByTestId('save-create-form'));

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'A form with this name already exists in this workspace.',
        type: 'error',
      }),
    );
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('falls back to the generic message when a create fails without one', async () => {
    mockCreateSobaFormioForm.mockRejectedValue(new ApiError('', 500));
    renderComponent();

    await userEvent.type(nameInput(), 'My New Form');
    await userEvent.selectOptions(screen.getByTestId('workspace-selector'), 'ws-1');
    await userEvent.click(screen.getByTestId('save-create-form'));

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Failed to save form.', type: 'error' }),
    );
  });

  it('shows disclaimer required warning if user capability is disclaimer_required', () => {
    (useCurrentUser as Mock).mockReturnValue({
      data: { capabilities: { formCreate: 'disclaimer_required' } },
      loaded: true,
    });
    renderComponent();
    expect(screen.getByTestId('disclaimer-required-alert')).toBeInTheDocument();
  });

  it('shows no workspace warning if user capability is not allowed', () => {
    (useCurrentUser as Mock).mockReturnValue({
      data: { capabilities: { formCreate: 'not_allowed' } },
      loaded: true,
    });
    renderComponent();
    expect(screen.getByTestId('designer-select-workspace')).toBeInTheDocument();
  });

  describe('submitter audience', () => {
    it('creates a form with a public audience', async () => {
      renderComponent();

      await userEvent.type(nameInput(), 'My New Form');
      await userEvent.selectOptions(screen.getByTestId('workspace-selector'), 'ws-1');

      // Click "Public" radio
      await userEvent.click(screen.getByTestId('audience-mode-public'));

      await userEvent.click(screen.getByTestId('save-create-form'));

      expect(mockCreateSobaFormioForm).toHaveBeenCalledWith(
        'mock-token',
        { name: 'My New Form', submitterAudience: { mode: 'public' } },
        'ws-1',
      );
    });

    it('creates a form with a protected audience and IDPs', async () => {
      renderComponent();

      await userEvent.type(nameInput(), 'My New Form');
      await userEvent.selectOptions(screen.getByTestId('workspace-selector'), 'ws-1');

      // Click "Protected" radio
      await userEvent.click(screen.getByTestId('audience-mode-protected'));

      // Click an IDP
      await userEvent.click(screen.getByTestId('audience-idp-azureidir'));

      await userEvent.click(screen.getByTestId('save-create-form'));

      expect(mockCreateSobaFormioForm).toHaveBeenCalledWith(
        'mock-token',
        { name: 'My New Form', submitterAudience: { mode: 'protected', idps: ['azureidir'] } },
        'ws-1',
      );
    });

    it('disables the save button if protected mode is selected but no IDPs are chosen', async () => {
      renderComponent();

      await userEvent.type(nameInput(), 'My New Form');
      await userEvent.selectOptions(screen.getByTestId('workspace-selector'), 'ws-1');

      const saveButton = screen.getByTestId('save-create-form');
      expect(saveButton).toBeEnabled();

      // Click "Protected" radio but no IDPs
      await userEvent.click(screen.getByTestId('audience-mode-protected'));

      expect(saveButton).toBeDisabled();

      // Click an IDP, it should re-enable
      await userEvent.click(screen.getByTestId('audience-idp-azureidir'));
      expect(saveButton).toBeEnabled();
    });
  });
});
