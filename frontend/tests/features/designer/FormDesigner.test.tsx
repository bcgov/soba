import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { useKeycloak as useKeycloakHook } from '@/lib/hooks/useKeycloak';

// Use a mutable keycloakState so tests can set it per-case.
let keycloakState: Partial<ReturnType<typeof useKeycloakHook>> = {
  authenticated: false,
  initializing: true,
};
vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => keycloakState,
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({ locale: 'en', form: {} }),
}));

const { mockDispatch } = vi.hoisted(() => ({ mockDispatch: vi.fn() }));
vi.mock('@/lib/store', () => ({
  useAppSelector: (fn: (s: unknown) => unknown) => fn({ notification: { notifications: [] } }),
  useAppDispatch: () => mockDispatch,
}));

import FormDesigner from '@/src/features/designer/ui/FormDesigner';

describe('FormDesigner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading message when initializing', () => {
    keycloakState = { authenticated: false, initializing: true };
    render(<FormDesigner onUpdateModel={() => {}} initialModel={null} />);
    expect(screen.getByText('Loading Designer...')).toBeInTheDocument();
  });

  it('shows login required when not authenticated', () => {
    keycloakState = { authenticated: false, initializing: false };
    render(<FormDesigner onUpdateModel={() => {}} initialModel={null} />);
    expect(screen.getByText('Login Required')).toBeInTheDocument();
  });
});
