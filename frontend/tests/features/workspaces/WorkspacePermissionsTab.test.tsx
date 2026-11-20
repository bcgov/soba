import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import en from '@/dictionaries/en.json';
import type { Dictionary } from '@/src/types/dictionary';

// Each drawer has its own tests. Here each is its own Accordion, as they are, showing only which
// workspace it was given.
const { stubDrawer } = vi.hoisted(() => ({
  stubDrawer: async (testId: string, label: 'accessTab' | 'groupsTab' | 'rolesTab') => {
    const { Accordion } = await import('@bcgov/design-system-react-components');
    const { workspaces } = (await import('@/dictionaries/en.json')).default;
    return function StubDrawer({
      drawerName,
      workspaceId,
    }: {
      drawerName: string;
      workspaceId: string;
    }) {
      return (
        <Accordion id={drawerName} label={workspaces[label]}>
          <div data-testid={testId}>{workspaceId}</div>
        </Accordion>
      );
    };
  },
}));
vi.mock('@/src/features/workspaces/ui/WorkspaceRoleDrawer', async () => ({
  default: await stubDrawer('roles-drawer', 'rolesTab'),
}));
vi.mock('@/src/features/workspaces/ui/WorkspaceGroupDrawer', async () => ({
  default: await stubDrawer('groups-drawer', 'groupsTab'),
}));
vi.mock('@/src/features/workspaces/ui/WorkspaceAccessDrawer', async () => ({
  default: await stubDrawer('access-drawer', 'accessTab'),
}));

import WorkspacePermissionsTab from '@/src/features/workspaces/ui/WorkspacePermissionsTab';

const dict: Dictionary = en;
const t = dict.workspaces;

const renderTab = () => render(<WorkspacePermissionsTab dict={dict} workspaceId="ws-1" />);
const header = (label: string) => screen.getByRole('button', { name: label });

describe('WorkspacePermissionsTab', () => {
  it('shows access, groups, and roles as drawers, in that order', () => {
    renderTab();

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      t.accessTab,
      t.groupsTab,
      t.rolesTab,
    ]);
  });

  it('opens with access expanded and the others closed', () => {
    renderTab();

    expect(header(t.accessTab)).toHaveAttribute('aria-expanded', 'true');
    expect(header(t.groupsTab)).toHaveAttribute('aria-expanded', 'false');
    expect(header(t.rolesTab)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('access-drawer')).toBeVisible();
    expect(screen.queryByTestId('groups-drawer')).not.toBeVisible();
    expect(screen.queryByTestId('roles-drawer')).not.toBeVisible();
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

    expect(header(t.accessTab)).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('access-drawer')).toBeVisible();

    await user.click(header(t.accessTab));

    expect(header(t.accessTab)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('access-drawer')).not.toBeVisible();
  });
});
