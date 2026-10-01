import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TemplateResponse } from '@/src/types/templates';
import type { Dictionary } from '@/src/types/dictionary';

const { mockAddNotification, mockUpload, mockRemove, mockDownload, mockUseTemplates } = vi.hoisted(
  () => ({
    mockAddNotification: vi.fn(),
    mockUpload: vi.fn(),
    mockRemove: vi.fn(),
    mockDownload: vi.fn(),
    mockUseTemplates: vi.fn(),
  }),
);

vi.mock('@bcgov/design-system-react-components', () => ({
  Accordion: ({ children, label }: { children: ReactNode; label: string }) => (
    <section>
      <h2>{label}</h2>
      {children}
    </section>
  ),
  Button: ({
    children,
    onPress,
    isDisabled,
    'data-testid': testId,
  }: {
    children: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    'data-testid'?: string;
  }) => (
    <button type="button" onClick={onPress} disabled={isDisabled} data-testid={testId}>
      {children}
    </button>
  ),
  TextField: ({
    label,
    value,
    onChange,
    isDisabled,
    'data-testid': testId,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    isDisabled?: boolean;
    'data-testid'?: string;
  }) => (
    <label>
      {label}
      <input
        data-testid={testId}
        value={value}
        disabled={isDisabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  ),
}));

vi.mock('@/src/components/DataTable', () => ({
  DataTable: ({
    data,
    columns,
    error,
    emptyMessage,
  }: {
    data: TemplateResponse[];
    columns: { key: string; label: string; render?: (template: TemplateResponse) => ReactNode }[];
    error: string | null;
    emptyMessage: string;
  }) => (
    <div>
      {error || (data.length === 0 ? emptyMessage : null)}
      <div>
        {columns.map((column) => (
          <span key={column.key} role="columnheader">
            {column.label}
          </span>
        ))}
      </div>
      {data.map((template) => (
        <div key={template.id}>
          {columns.map((column) => (
            <span key={column.key}>
              {column.render
                ? column.render(template)
                : String(template[column.key as keyof TemplateResponse] ?? '')}
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/src/components/ConfirmModal', () => ({
  ConfirmModal: ({
    show,
    title,
    message,
    confirmLabel,
    onConfirm,
  }: {
    show: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }) =>
    show ? (
      <div role="dialog" aria-label={title}>
        <p>{message}</p>
        <button type="button" data-testid="confirm-template-delete" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock('@/src/components/RowActionButton', () => ({
  RowActionButton: ({
    children,
    onPress,
    'data-testid': testId,
    'aria-label': ariaLabel,
  }: {
    children: ReactNode;
    onPress: () => void;
    'data-testid'?: string;
    'aria-label'?: string;
  }) => (
    <button type="button" onClick={onPress} data-testid={testId} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock('@/src/shared/hooks/useFormatLongDate', () => ({
  useFormatLongDate: () => (value: string) => value,
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({ useKeycloak: () => ({ token: 'token' }) }));
vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification: mockAddNotification }),
}));
vi.mock('@/src/features/designer/data/useForm', () => ({
  useForm: () => ({ currentVersion: { id: 'version-1' } }),
}));
vi.mock('@/src/features/templates/data/useTemplates', () => ({
  useTemplates: mockUseTemplates,
}));

import TemplatesDrawer from '@/src/features/templates/ui/TemplatesDrawer';

const template: TemplateResponse = {
  id: 'template-1',
  formId: 'form-1',
  formVersionId: 'version-1',
  name: 'Annual report',
  filename: 'annual-report.docx',
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  size: 512,
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedBy: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockDict = {
  form: {
    templates: {
      drawerLabel: 'Document Templates',
      versionColumn: 'Form Version',
      versionUnavailable: 'Unavailable',
      nameLabel: 'Template Name',
      fileLabel: 'Template File',
      acceptedTypes: 'Accepted file types: {types}.',
      upload: 'Upload',
      uploading: 'Uploading',
      uploadSuccess: 'Template uploaded.',
      uploadError: 'Upload failed.',
      download: 'Download',
      downloadError: 'Download failed.',
      delete: 'Delete',
      deleteTitle: 'Delete template',
      deleteMessage: 'Delete "{name}"?',
      deleteSuccess: 'Template deleted.',
      deleteError: 'Delete failed.',
      loadError: 'Load failed.',
      empty: 'No templates.',
      nameColumn: 'Name',
      fileColumn: 'File',
      sizeColumn: 'Size',
      updatedColumn: 'Last Updated',
      actionsColumn: 'Actions',
    },
  },
  general: { sessionExpired: 'Session ended.', noAccess: 'No access.' },
} as unknown as Dictionary;

function renderDrawer() {
  return render(
    <TemplatesDrawer
      dict={mockDict}
      drawerName="document-templates"
      formId="form-1"
      formVersionId="version-1"
      formVersionNo={2}
    />,
  );
}

describe('TemplatesDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTemplates.mockReturnValue({
      templates: [template],
      loading: false,
      error: null,
      upload: mockUpload,
      remove: mockRemove,
      download: mockDownload,
    });
    mockUpload.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
    mockDownload.mockResolvedValue(undefined);
  });

  it('uploads a selected file under the entered template name', async () => {
    const user = userEvent.setup();
    renderDrawer();

    const file = new File(['template'], 'annual-report.docx');
    await user.upload(screen.getByTestId('template-file-input'), file);

    expect(screen.getByTestId('template-name-field')).toHaveValue('annual-report');
    await user.click(screen.getByTestId('template-upload-button'));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith('token', 'annual-report', file));
    expect(mockUseTemplates).toHaveBeenCalledWith('version-1');
    expect(mockAddNotification).toHaveBeenCalledWith({
      text: 'Template uploaded.',
      type: 'success',
    });
  });

  it('shows the selected version as read-only and in the template list', () => {
    renderDrawer();

    expect(screen.getByRole('columnheader', { name: 'Form Version' })).toBeInTheDocument();
    expect(screen.getByTestId('template-template-1-version')).toHaveTextContent('v2');
  });

  it('downloads a template when its name is clicked', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByTestId('template-template-1-download'));

    expect(mockDownload).toHaveBeenCalledWith('token', template);
  });

  it('deletes a template after confirmation', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByTestId('template-template-1-delete'));
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete "Annual report"?');
    await user.click(screen.getByTestId('confirm-template-delete'));

    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('token', 'template-1'));
    expect(mockAddNotification).toHaveBeenCalledWith({
      text: 'Template deleted.',
      type: 'success',
    });
  });
});
