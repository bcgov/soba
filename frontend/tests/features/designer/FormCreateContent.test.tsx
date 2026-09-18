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
vi.mock('@/src/shared/api/sobaApi', () => ({
  createSobaFormioForm: (...args: unknown[]) => mockCreateSobaFormioForm(...args),
}));

vi.mock('@/src/shared/api/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('@/src/shared/api/useWorkspaces', () => ({
  useFormCreateWorkspaceOptions: vi.fn(),
}));

vi.mock('@/src/features/designer/ui/FormSubmitterAudience', () => ({
  FormSubmitterAudience: () => <div data-testid="form-submitter-audience" />,
}));

vi.mock('@bcgov/design-system-react-components', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Form: ({
      children,
      onSubmit,
      ...rest
    }: {
      children: React.ReactNode;
      onSubmit?: React.FormEventHandler<HTMLFormElement>;
      [key: string]: unknown;
    }) => (
      <form onSubmit={onSubmit} {...rest}>
        {children}
      </form>
    ),
    TextField: ({
      label,
      value,
      onChange,
      'data-testid': testid,
    }: {
      label: string;
      value: string;
      onChange: (val: string) => void;
      'data-testid': string;
    }) => (
      <div>
        <label>{label}</label>
        <input data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    ),
    Button: ({
      children,
      onPress,
      isDisabled,
      'data-testid': testid,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      isDisabled?: boolean;
      'data-testid': string;
    }) => (
      <button data-testid={testid} disabled={isDisabled} onClick={onPress}>
        {children}
      </button>
    ),
    InlineAlert: ({
      children,
      'data-testid': testid,
    }: {
      children: React.ReactNode;
      'data-testid': string;
    }) => <div data-testid={testid}>{children}</div>,
  };
});

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
  });

  const renderComponent = () => render(<FormCreateContent onCancelPress={vi.fn()} />);

  it('renders form name input and workspace selector', () => {
    renderComponent();
    expect(screen.getByTestId('form-name-modal')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-selector')).toBeInTheDocument();
  });

  it('shows notification if form name is empty on save', async () => {
    renderComponent();
    const saveButton = screen.getByTestId('save-create-form');

    // Select workspace
    const select = screen.getByTestId('workspace-selector');
    await userEvent.selectOptions(select, 'ws-1');

    await userEvent.click(saveButton);
    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Enter a form name.', type: 'error' }),
    );
  });

  it('shows notification if workspace is not selected on save', async () => {
    renderComponent();
    const saveButton = screen.getByTestId('save-create-form');

    // Enter form name
    const input = screen.getByTestId('form-name-modal');
    await userEvent.type(input, 'My New Form');

    await userEvent.click(saveButton);
    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Select a workspace before saving this form.',
        type: 'error',
      }),
    );
  });

  it('creates form successfully and redirects', async () => {
    mockCreateSobaFormioForm.mockResolvedValue({ id: 'form-123' });
    renderComponent();

    // Enter form name
    const input = screen.getByTestId('form-name-modal');
    await userEvent.type(input, 'My New Form');

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

  it('handles conflict error on save', async () => {
    mockCreateSobaFormioForm.mockRejectedValue(new ApiError('Conflict', 409));
    renderComponent();

    const input = screen.getByTestId('form-name-modal');
    await userEvent.type(input, 'My New Form');

    const select = screen.getByTestId('workspace-selector');
    await userEvent.selectOptions(select, 'ws-1');

    const saveButton = screen.getByTestId('save-create-form');
    await userEvent.click(saveButton);

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Version conflict.', type: 'error' }),
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
});
