import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ authenticated: true, token: 'token', initializing: false }),
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    form: {
      loading: 'Loading',
      apiKey: 'API Key',
      nameLabel: 'Form Name',
      descriptionLabel: 'Description',
    },
    general: { notAuthenticated: 'Not authed' },
    locale: 'en',
  }),
}));

const { mockDispatch } = vi.hoisted(() => ({ mockDispatch: vi.fn() }));
vi.mock('@/lib/store', () => ({
  useAppSelector: (fn: (s: unknown) => unknown) =>
    fn({ workspace: { activeWorkspaceId: 'ws1' }, notification: { notifications: [] } }),
  useAppDispatch: () => mockDispatch,
}));

// Mock the soba API functions used by FormForm
vi.mock('@/src/shared/api/sobaApi', () => ({
  getSobaForm: vi.fn().mockResolvedValue({ id: 'f1', name: 'Test', description: '' }),
  getSobaFormVersions: vi.fn().mockResolvedValue({ items: [] }),
  getFormVersionSchema: vi.fn().mockResolvedValue(null),
}));

// Mock DynamicForm and FormDesigner components used in FormForm
vi.mock('@/src/features/formio-v5/ui/DynamicForm', () => ({
  DynamicForm: () => <div data-testid="dynamic-form">preview</div>,
}));
vi.mock('@/src/features/designer/ui/FormDesigner', () => ({
  __esModule: true,
  default: () => <div data-testid="form-designer">designer</div>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {} }),
  useParams: () => ({ lang: 'en' }),
}));

import FormForm from '@/src/features/designer/ui/FormForm';

describe('FormForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders designer tab content when authenticated and not initializing', async () => {
    render(<FormForm id={['f1']} />);
    // The designer area includes a form name input; assert it renders with loaded value
    await waitFor(() => expect(screen.getByDisplayValue('Test')).toBeInTheDocument());
  });
});
