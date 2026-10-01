import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Dictionary } from '@/src/types/dictionary';

const { mockUseForm } = vi.hoisted(() => ({ mockUseForm: vi.fn() }));

vi.mock('@bcgov/design-system-react-components', () => ({
  AccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/src/features/designer/data/useForm', () => ({ useForm: mockUseForm }));

vi.mock('@/src/features/form-settings/data/sections', () => ({
  useFormSettingsSections: () => [
    {
      id: 'document-templates',
      Drawer: ({
        formVersionId,
        formVersionNo,
      }: {
        formVersionId: string | null;
        formVersionNo: number | null;
      }) => (
        <div
          data-testid="template-version-props"
          data-version-id={formVersionId ?? ''}
          data-version-no={formVersionNo ?? ''}
        />
      ),
    },
  ],
}));

import FormSettingsTab from '@/src/features/designer/ui/FormSettingsTab';

const dict = { general: { loading: 'Loading' } } as unknown as Dictionary;

describe('FormSettingsTab version selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseForm.mockReturnValue({
      form: { id: 'form-1', workspaceId: 'workspace-1' },
      currentVersion: { id: 'current-v3', versionNo: 3 },
      loading: false,
    });
  });

  it('passes the selected historical version to its settings drawers', () => {
    render(
      <FormSettingsTab
        dict={dict}
        formId="form-1"
        selectedVersion={{ id: 'history-v2', versionNo: 2 }}
      />,
    );

    expect(screen.getByTestId('template-version-props')).toHaveAttribute(
      'data-version-id',
      'history-v2',
    );
    expect(screen.getByTestId('template-version-props')).toHaveAttribute('data-version-no', '2');
  });

  it('defaults settings drawers to the current form version', () => {
    render(<FormSettingsTab dict={dict} formId="form-1" />);

    expect(screen.getByTestId('template-version-props')).toHaveAttribute(
      'data-version-id',
      'current-v3',
    );
    expect(screen.getByTestId('template-version-props')).toHaveAttribute('data-version-no', '3');
  });
});
