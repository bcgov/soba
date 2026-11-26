import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import en from '@/dictionaries/en.json';
import fr from '@/dictionaries/fr.json';
import type { Dictionary } from '@/src/types/dictionary';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import type { WorkspaceRole } from '@/src/types/workspaceRoles';
import { WORKSPACE_ID, renderSignedIn } from './workspaceGroupsTestKit';

const { mockApi, mockLocale, mockAddNotification } = vi.hoisted(() => ({
  mockApi: {
    listWorkspaceRoles: vi.fn(),
    getWorkspaceRole: vi.fn(),
    checkWorkspaceRoleName: vi.fn(),
    createWorkspaceRole: vi.fn(),
    updateWorkspaceRole: vi.fn(),
    deleteWorkspaceRole: vi.fn(),
  },
  mockLocale: { value: 'en' },
  mockAddNotification: vi.fn(),
}));

vi.mock('@/src/features/workspaces/data/api', () => mockApi);

vi.mock('@/src/shared/list/useSortLocale', () => ({ useSortLocale: () => mockLocale.value }));

vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ authenticated: true, token: 'token', initializing: false }),
}));

vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification: mockAddNotification }),
}));

const dict = { ...en, locale: 'en' } as unknown as Dictionary;
const t = dict.workspaces.roles;

vi.mock('@/app/[lang]/Providers', () => ({ useDictionary: () => dict }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/workspace/ws-1',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import { AccordionGroup } from '@bcgov/design-system-react-components';
import WorkspaceRoleDrawer from '@/src/features/workspaces/ui/WorkspaceRoleDrawer';

const role = (
  roleCode: string,
  name: string,
  permissions: string[],
  system = true,
): WorkspaceRole => ({ roleCode, name, system, permissions });

const FORM_ADMIN = role('form_admin', 'Form administrator', ['*']);
const FORM_SUBMITTER = role('form_submitter', 'Form submitter', [
  'document_template_read',
  'submission_create',
]);
const TEAM_MANAGER = role('team_manager', 'Team manager', [
  'form_read',
  'team_read',
  'team_update',
]);
const FORM_DESIGNER = role('form_designer', 'Form designer', ['design_read', 'form_read']);
const FIXED = [TEAM_MANAGER, FORM_ADMIN, FORM_SUBMITTER, FORM_DESIGNER];
const AUDITOR = role('custom-1', 'Auditor', ['form_read', 'submission_read'], false);

const renderDrawer = (drawerDict: Dictionary = dict) =>
  renderSignedIn(
    <AccordionGroup defaultExpandedKeys={['workspace-roles']}>
      <WorkspaceRoleDrawer
        dict={drawerDict}
        drawerName="workspace-roles"
        workspaceId={WORKSPACE_ID}
      />
    </AccordionGroup>,
  );

const shownNames = () => screen.getAllByTestId(/^role-name-(?!input)/).map((c) => c.textContent);
const permissionBox = (code: keyof typeof en.workspaces.roles.permissionNames) =>
  screen.getByRole('checkbox', { name: t.permissionNames[code] });
const nameInput = () => screen.getByRole('textbox', { name: new RegExp(t.name) });
const saveButton = () => screen.getByTestId('role-submit-button');
/** Save waits for the name to be checked, as a person would see it do. */
const saveOnceChecked = async (user: ReturnType<typeof userEvent.setup>) => {
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await user.click(saveButton());
};
const nameStatus = () => screen.getByTestId('role-name-status');

const typeSearch = async (
  user: ReturnType<typeof userEvent.setup>,
  box: HTMLElement,
  term: string,
) => {
  await user.click(box);
  await user.paste(term);
  await user.keyboard('{Enter}');
};

describe('WorkspaceRoleDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocale.value = 'en';
    window.history.replaceState(null, '', '/en/workspace/ws-1');
    window.sessionStorage.clear();
    const items = [...FIXED, AUDITOR];
    mockApi.listWorkspaceRoles.mockResolvedValue({ items });
    mockApi.getWorkspaceRole.mockImplementation(async (_token, _workspace, code) =>
      items.find((item) => item.roleCode === code),
    );
    mockApi.checkWorkspaceRoleName.mockResolvedValue({ available: true });
    mockApi.createWorkspaceRole.mockResolvedValue(AUDITOR);
    mockApi.updateWorkspaceRole.mockResolvedValue(AUDITOR);
    mockApi.deleteWorkspaceRole.mockResolvedValue(undefined);
  });

  it('is its own drawer, named for roles', async () => {
    renderDrawer();
    await screen.findByTestId('role-name-form_admin');

    expect(screen.getByTestId('accordion-workspace-roles')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: dict.workspaces.rolesTab })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('lists each role by its stored name, with its type and permission count', async () => {
    renderDrawer();

    expect(await screen.findByTestId('role-name-form_admin')).toHaveTextContent(
      'Form administrator',
    );
    expect(mockApi.listWorkspaceRoles).toHaveBeenCalledWith('token', WORKSPACE_ID);
    expect(screen.getByTestId('role-type-form_admin')).toHaveTextContent(t.types.fixed);
    expect(screen.getByTestId('role-permissions-form_admin')).toHaveTextContent(t.allPermissions);
    expect(screen.getByTestId('role-permissions-team_manager')).toHaveTextContent('3 permissions');
    expect(screen.getByTestId('role-name-custom-1')).toHaveTextContent('Auditor');
    expect(screen.getByTestId('role-type-custom-1')).toHaveTextContent(t.types.custom);
    expect(screen.getByTestId('role-permissions-custom-1')).toHaveTextContent('2 permissions');
  });

  it('counts a single permission in the singular', async () => {
    mockApi.listWorkspaceRoles.mockResolvedValue({
      items: [role('custom-2', 'Reader', ['form_read'], false)],
    });
    renderDrawer();

    expect(await screen.findByTestId('role-permissions-custom-2')).toHaveTextContent(
      t.permissionCountOne,
    );
  });

  it('offers View on a fixed role, and Edit and Remove on a custom one', async () => {
    renderDrawer();
    await screen.findByTestId('role-name-form_admin');

    expect(screen.getByTestId('view-role-button-form_admin')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-role-button-form_admin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-role-button-form_admin')).not.toBeInTheDocument();
    expect(screen.getByTestId('edit-role-button-custom-1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-role-button-custom-1')).toBeInTheDocument();
    expect(screen.queryByTestId('view-role-button-custom-1')).not.toBeInTheDocument();
  });

  it('orders by stored name, and reverses when the name header is pressed', async () => {
    const user = userEvent.setup();
    const view = renderDrawer();
    await screen.findByTestId('role-name-form_admin');

    expect(shownNames()).toEqual([
      'Auditor',
      'Form administrator',
      'Form designer',
      'Form submitter',
      'Team manager',
    ]);

    await user.click(screen.getByTestId('datatable-sort-name'));
    await view.rerender();

    expect(shownNames()).toEqual([
      'Team manager',
      'Form submitter',
      'Form designer',
      'Form administrator',
      'Auditor',
    ]);
  });

  it('shows and orders the stored names in French too', async () => {
    mockLocale.value = 'fr';
    mockApi.listWorkspaceRoles.mockResolvedValue({ items: FIXED });
    renderDrawer({ ...fr, locale: 'fr' } as unknown as Dictionary);
    await screen.findByTestId('role-name-form_admin');

    expect(shownNames()).toEqual([
      'Form administrator',
      'Form designer',
      'Form submitter',
      'Team manager',
    ]);
  });

  it('searches the stored name, not the translated label', async () => {
    mockLocale.value = 'fr';
    const frDict = { ...fr, locale: 'fr' } as unknown as Dictionary;
    const user = userEvent.setup();
    const view = renderDrawer(frDict);
    await screen.findByTestId('role-name-form_admin');
    const box = within(screen.getByTestId('search-ws-roles-text')).getByRole('textbox');

    await typeSearch(user, box, 'form admin');
    await view.rerender();
    expect(shownNames()).toEqual(['Form administrator']);

    await user.clear(box);
    await typeSearch(user, box, 'administrateur');
    await view.rerender();
    expect(await screen.findByText(frDict.workspaces.roles.empty)).toBeInTheDocument();
  });

  it('shows the page the URL names', async () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      role(`custom-${index}`, `Role ${String(index).padStart(2, '0')}`, ['form_read'], false),
    );
    mockApi.listWorkspaceRoles.mockResolvedValue({ items });
    window.history.replaceState(null, '', '/en/workspace/ws-1?workspaceRoles.page=2');
    renderDrawer();

    await screen.findByTestId('role-name-custom-11');
    expect(shownNames()).toEqual(['Role 10', 'Role 11']);
  });

  it('opens a fixed role below the table for reference, with nothing to save', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByTestId('view-role-button-form_submitter'));

    const section = await screen.findByTestId('workspace-role-edit-form');
    expect(await within(section).findByTestId('fixed-role-alert')).toBeInTheDocument();
    expect(nameInput()).toBeDisabled();
    expect(nameInput()).toHaveValue(dict.workspaces.groups.roleNames.form_submitter);
    const ticked = within(section)
      .getAllByRole('checkbox')
      .filter((box) => (box as HTMLInputElement).checked);
    expect(ticked).toHaveLength(2);
    expect(permissionBox('submission_create')).toBeChecked();
    expect(permissionBox('submission_create')).toBeDisabled();
    expect(permissionBox('form_delete')).not.toBeChecked();
    expect(screen.queryByTestId('role-submit-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('role-permissions-help')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('role-cancel-button'));
    expect(screen.queryByTestId('workspace-role-edit-form')).not.toBeInTheDocument();
  });

  it('ticks every permission for a role holding the wildcard', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByTestId('view-role-button-form_admin'));

    const section = await screen.findByTestId('workspace-role-edit-form');
    await within(section).findByTestId('fixed-role-alert');
    const boxes = within(section).getAllByRole('checkbox');
    expect(boxes).toHaveLength(19);
    for (const box of boxes) expect(box).toBeChecked();
  });

  it('creates a role with what was ticked and what that needs, then closes', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await screen.findByTestId('role-name-form_admin');
    const readsBefore = mockApi.listWorkspaceRoles.mock.calls.length;

    await user.click(screen.getByTestId('create-ws-role-button'));
    expect(screen.getByTestId('workspace-role-create-form')).toBeInTheDocument();
    expect(screen.getByTestId('role-submit-button')).toBeDisabled();

    await user.click(nameInput());
    await user.paste('  Clerk  ');
    expect(screen.getByTestId('role-submit-button')).toBeDisabled();

    await user.click(permissionBox('submission_review'));
    expect(permissionBox('submission_read')).toBeChecked();
    expect(permissionBox('form_read')).toBeChecked();

    await saveOnceChecked(user);
    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', text: t.createSuccess }),
      ),
    );
    const [, workspaceId, body] = mockApi.createWorkspaceRole.mock.calls[0];
    expect(workspaceId).toBe(WORKSPACE_ID);
    expect(body.name).toBe('Clerk');
    expect(new Set(body.permissionCodes)).toEqual(
      new Set(['submission_review', 'submission_read', 'form_read']),
    );
    expect(screen.queryByTestId('workspace-role-create-form')).not.toBeInTheDocument();
    expect(mockApi.listWorkspaceRoles.mock.calls.length).toBeGreaterThan(readsBefore);
  });

  it('saves without a permission that was auto-ticked and then unticked', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByTestId('create-ws-role-button'));
    await user.click(nameInput());
    await user.paste('Add-on');
    await user.click(permissionBox('submission_read'));
    await user.click(permissionBox('form_read'));
    expect(permissionBox('form_read')).not.toBeChecked();
    expect(permissionBox('submission_read')).toBeChecked();

    await saveOnceChecked(user);
    await waitFor(() => expect(mockApi.createWorkspaceRole).toHaveBeenCalled());
    expect(mockApi.createWorkspaceRole.mock.calls[0][2].permissionCodes).toEqual([
      'submission_read',
    ]);
  });

  it('will not save a role with no permissions left', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByTestId('edit-role-button-custom-1'));
    await screen.findByDisplayValue('Auditor');
    await user.click(permissionBox('form_read'));
    await user.click(permissionBox('submission_read'));

    expect(screen.getByTestId('role-submit-button')).toBeDisabled();
  });

  it('says why a create was refused and keeps the form open', async () => {
    const user = userEvent.setup();
    mockApi.createWorkspaceRole.mockRejectedValue(
      new ApiError('A role with this name already exists', 409, 'role_name_taken'),
    );
    renderDrawer();
    await user.click(await screen.findByTestId('create-ws-role-button'));
    await user.click(nameInput());
    await user.paste('Auditor');
    await user.click(permissionBox('form_read'));
    await saveOnceChecked(user);

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text: en.apiErrors.role_name_taken }),
      ),
    );
    expect(screen.getByTestId('workspace-role-create-form')).toBeInTheDocument();
  });

  it('seeds an edit from the role read by code, enabled', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByTestId('edit-role-button-custom-1'));

    await screen.findByDisplayValue('Auditor');
    expect(mockApi.getWorkspaceRole).toHaveBeenCalledWith('token', WORKSPACE_ID, 'custom-1');
    expect(nameInput()).toBeEnabled();
    expect(permissionBox('submission_read')).toBeChecked();
    expect(permissionBox('submission_read')).toBeEnabled();
    expect(screen.queryByTestId('fixed-role-alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('role-permissions-help')).toHaveTextContent(t.permissionsHelp);
  });

  it('sends only the name when only the name changed', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByTestId('edit-role-button-custom-1'));
    await screen.findByDisplayValue('Auditor');
    await user.clear(nameInput());
    await user.paste('Inspector');
    await saveOnceChecked(user);

    await waitFor(() =>
      expect(mockApi.updateWorkspaceRole).toHaveBeenCalledWith('token', WORKSPACE_ID, 'custom-1', {
        name: 'Inspector',
      }),
    );
    // A rename is checked without counting the role's own name.
    expect(mockApi.checkWorkspaceRoleName).toHaveBeenCalledWith('token', WORKSPACE_ID, {
      name: 'Inspector',
      excludeCode: 'custom-1',
    });
  });

  it('says as it is typed that a name is free', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByTestId('create-ws-role-button'));
    await user.click(nameInput());
    await user.paste('  Clerk  ');

    await waitFor(() => expect(nameStatus()).toHaveTextContent(dict.general.nameAvailable));
    expect(screen.getByTestId('role-name-input')).toHaveTextContent(
      `${dict.general.nameAvailable} ✓`,
    );
    expect(mockApi.checkWorkspaceRoleName).toHaveBeenCalledWith('token', WORKSPACE_ID, {
      name: 'Clerk',
      excludeCode: undefined,
    });
  });

  it('says as it is typed that a name is taken, and will not save it', async () => {
    const user = userEvent.setup();
    mockApi.checkWorkspaceRoleName.mockResolvedValue({ available: false });
    renderDrawer();
    await user.click(await screen.findByTestId('create-ws-role-button'));
    await user.click(nameInput());
    await user.paste('Auditor');
    await user.click(permissionBox('form_read'));

    await waitFor(() => expect(nameStatus()).toHaveTextContent(dict.general.nameUnavailable));
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('role-name-input')).toHaveTextContent(
      `${dict.general.nameUnavailable} ✕`,
    );
    expect(saveButton()).toBeDisabled();
    expect(mockApi.createWorkspaceRole).not.toHaveBeenCalled();
  });

  it("does not check a role's unchanged name, or a fixed role's", async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByTestId('edit-role-button-custom-1'));
    await screen.findByDisplayValue('Auditor');
    await user.click(permissionBox('team_read'));
    expect(saveButton()).toBeEnabled();

    await user.click(screen.getByTestId('view-role-button-form_admin'));
    await screen.findByTestId('fixed-role-alert');
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(mockApi.checkWorkspaceRoleName).not.toHaveBeenCalled();
  });

  it('sends only the permissions when only they changed', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByTestId('edit-role-button-custom-1'));
    await screen.findByDisplayValue('Auditor');
    await user.click(permissionBox('team_read'));
    await user.click(screen.getByTestId('role-submit-button'));

    await waitFor(() => expect(mockApi.updateWorkspaceRole).toHaveBeenCalled());
    const [, , , body] = mockApi.updateWorkspaceRole.mock.calls[0];
    expect(Object.keys(body)).toEqual(['permissionCodes']);
    expect(new Set(body.permissionCodes)).toEqual(
      new Set(['form_read', 'submission_read', 'team_read']),
    );
  });

  it('sends nothing when nothing changed, and still closes', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByTestId('edit-role-button-custom-1'));
    await screen.findByDisplayValue('Auditor');
    await user.click(screen.getByTestId('role-submit-button'));

    await waitFor(() =>
      expect(screen.queryByTestId('workspace-role-edit-form')).not.toBeInTheDocument(),
    );
    expect(mockApi.updateWorkspaceRole).not.toHaveBeenCalled();
  });

  it('removes a role once confirmed, closing its open form', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByTestId('edit-role-button-custom-1'));
    await screen.findByDisplayValue('Auditor');
    const readsBefore = mockApi.listWorkspaceRoles.mock.calls.length;

    await user.click(screen.getByTestId('delete-role-button-custom-1'));
    await user.click(screen.getByRole('button', { name: t.deleteRole }));

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', text: t.deleteSuccess }),
      ),
    );
    expect(mockApi.deleteWorkspaceRole).toHaveBeenCalledWith('token', WORKSPACE_ID, 'custom-1');
    expect(mockApi.listWorkspaceRoles.mock.calls.length).toBeGreaterThan(readsBefore);
    expect(screen.queryByTestId('workspace-role-edit-form')).not.toBeInTheDocument();
  });

  it('says a role is still on a group when the delete is refused, and keeps it', async () => {
    const user = userEvent.setup();
    mockApi.deleteWorkspaceRole.mockRejectedValue(
      new ApiError('This role is still assigned to a group', 409, 'role_in_use'),
    );
    renderDrawer();
    await user.click(await screen.findByTestId('delete-role-button-custom-1'));
    await user.click(screen.getByRole('button', { name: t.deleteRole }));

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text: en.apiErrors.role_in_use }),
      ),
    );
    expect(screen.getByTestId('role-name-custom-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.deleteRole })).not.toBeInTheDocument();
  });

  it('leaves an open create form alone when another role is removed', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByTestId('create-ws-role-button'));
    await user.click(nameInput());
    await user.paste('Inspector');
    await user.click(screen.getByTestId('delete-role-button-custom-1'));
    await user.click(screen.getByRole('button', { name: t.deleteRole }));

    await waitFor(() => expect(mockApi.deleteWorkspaceRole).toHaveBeenCalled());
    expect(screen.getByTestId('workspace-role-create-form')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Inspector')).toBeInTheDocument();
  });

  it('re-reads the list after a refused create', async () => {
    const user = userEvent.setup();
    mockApi.createWorkspaceRole.mockRejectedValue(new ApiError('Request failed (500)', 500));
    renderDrawer();
    await user.click(await screen.findByTestId('create-ws-role-button'));
    await user.click(nameInput());
    await user.paste('Inspector');
    await user.click(permissionBox('form_read'));
    const readsBefore = mockApi.listWorkspaceRoles.mock.calls.length;

    await saveOnceChecked(user);

    await waitFor(() =>
      expect(mockApi.listWorkspaceRoles.mock.calls.length).toBeGreaterThan(readsBefore),
    );
  });

  it('re-reads the list after a refused edit, as the role may have gone', async () => {
    const user = userEvent.setup();
    mockApi.updateWorkspaceRole.mockRejectedValue(new ApiError('Role not found', 404));
    renderDrawer();
    await user.click(await screen.findByTestId('edit-role-button-custom-1'));
    await screen.findByDisplayValue('Auditor');
    await user.clear(nameInput());
    await user.paste('Inspector');
    const readsBefore = mockApi.listWorkspaceRoles.mock.calls.length;

    await saveOnceChecked(user);

    await waitFor(() =>
      expect(mockApi.listWorkspaceRoles.mock.calls.length).toBeGreaterThan(readsBefore),
    );
  });

  it('re-reads the list after a refused delete', async () => {
    const user = userEvent.setup();
    mockApi.deleteWorkspaceRole.mockRejectedValue(
      new ApiError('This role is still assigned to a group', 409, 'role_in_use'),
    );
    renderDrawer();
    await user.click(await screen.findByTestId('delete-role-button-custom-1'));
    const readsBefore = mockApi.listWorkspaceRoles.mock.calls.length;
    await user.click(screen.getByRole('button', { name: t.deleteRole }));

    await waitFor(() =>
      expect(mockApi.listWorkspaceRoles.mock.calls.length).toBeGreaterThan(readsBefore),
    );
  });

  it('shows no fields when the role cannot be read', async () => {
    const user = userEvent.setup();
    mockApi.getWorkspaceRole.mockRejectedValue(new ApiError('Request failed (500)', 500));
    renderDrawer();
    await user.click(await screen.findByTestId('edit-role-button-custom-1'));

    expect(await screen.findByTestId('role-load-error')).toHaveTextContent(t.roleLoadError);
    expect(screen.queryByTestId('role-submit-button')).not.toBeInTheDocument();
  });

  it('reports a failed load in the table', async () => {
    mockApi.listWorkspaceRoles.mockRejectedValue(new ApiError('Request failed (500)', 500));
    renderDrawer();

    expect(await screen.findByText(t.loadError)).toBeInTheDocument();
  });
});
