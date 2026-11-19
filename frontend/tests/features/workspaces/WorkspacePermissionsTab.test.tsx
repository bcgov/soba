import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import en from '@/dictionaries/en.json';
import type { Dictionary } from '@/src/types/dictionary';

// Each drawer has its own tests; here they only show which workspace they were given.
vi.mock('@/src/features/workspaces/ui/WorkspaceRoleDrawer', () => ({
  default: ({ workspaceId }: { workspaceId: string }) => (
    <div data-testid="roles-drawer">{workspaceId}</div>
  ),
}));
vi.mock('@/src/features/workspaces/ui/WorkspaceGroupDrawer', () => ({
  default: ({ workspaceId }: { workspaceId: string }) => (
    <div data-testid="groups-drawer">{workspaceId}</div>
  ),
}));
vi.mock('@/src/features/workspaces/ui/WorkspaceAccessDrawer', () => ({
  default: ({ workspaceId }: { workspaceId: string }) => (
    <div data-testid="access-drawer">{workspaceId}</div>
  ),
}));

import WorkspacePermissionsTab from '@/src/features/workspaces/ui/WorkspacePermissionsTab';

const dict: Dictionary = en;
const t = dict.workspaces;

const renderTab = () => render(<WorkspacePermissionsTab dict={dict} workspaceId="ws-1" />);
const header = (label: string) => screen.getByRole('button', { name: label });

describe('WorkspacePermissionsTab', () => {
  it('shows roles, groups and access as drawers, in that order', () => {
    renderTab();

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      t.rolesTab,
      t.groupsTab,
      t.accessTab,
    ]);
  });

  it('opens with roles expanded and the others closed', () => {
    renderTab();

    expect(header(t.rolesTab)).toHaveAttribute('aria-expanded', 'true');
    expect(header(t.groupsTab)).toHaveAttribute('aria-expanded', 'false');
    expect(header(t.accessTab)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('roles-drawer')).toBeVisible();
    expect(screen.queryByTestId('groups-drawer')).not.toBeVisible();
    expect(screen.queryByTestId('access-drawer')).not.toBeVisible();
  });

  it('gives each drawer the workspace', () => {
    renderTab();

    for (const id of ['roles-drawer', 'groups-drawer', 'access-drawer']) {
      expect(screen.getByTestId(id)).toHaveTextContent('ws-1');
    }
  });

  it('keeps one drawer open at a time', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(header(t.groupsTab));

    expect(header(t.groupsTab)).toHaveAttribute('aria-expanded', 'true');
    expect(header(t.rolesTab)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('groups-drawer')).toBeVisible();
    expect(screen.getByTestId('roles-drawer')).not.toBeVisible();

    await user.click(header(t.accessTab));

    expect(header(t.accessTab)).toHaveAttribute('aria-expanded', 'true');
    expect(header(t.groupsTab)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('access-drawer')).toBeVisible();
  });

  it('closes the open drawer when its header is clicked again', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(header(t.rolesTab));

    expect(header(t.rolesTab)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('roles-drawer')).not.toBeVisible();
  });
});
