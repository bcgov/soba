import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspaceRoleBadge } from '@/src/features/workspaces/ui/WorkspaceRoleBadge';

describe('WorkspaceRoleBadge', () => {
  it('renders owner role with formatted label', () => {
    render(<WorkspaceRoleBadge role="owner" data-testid="role-badge" />);
    expect(screen.getByTestId('role-badge')).toHaveTextContent('Owner');
  });

  it('renders unknown roles with capitalized label', () => {
    render(<WorkspaceRoleBadge role="custom" data-testid="role-badge" />);
    expect(screen.getByTestId('role-badge')).toHaveTextContent('Custom');
  });
});
