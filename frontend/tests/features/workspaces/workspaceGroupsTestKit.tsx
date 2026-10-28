import React, { act } from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { SWRConfig, type Cache } from 'swr';

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import type {
  ListWorkspaceGroupsResponse,
  RoleWithSourceMeta,
  WorkspaceGroup,
} from '@/src/types/workspaceGroups';

/**
 * Workspace group test helpers. Tests render real hooks against a signed-in store and mock only
 * the API modules. Pass the same `cache` to two renders to see what one leaves for the next.
 *
 * `rerender` renders the same tree again, keeping the store and cache. The mocked
 * `useSearchParams` cannot subscribe to `history.replaceState` the way Next's does, so a test
 * that changes the list query calls it to pick up the URL the list wrote.
 *
 * `show` swaps what is under the providers, which stay mounted as they do in the app. A test that
 * closes and reopens a form uses it: unmounting the providers drops SWR's cache with them.
 */
export function renderSignedIn(ui: React.ReactElement, cache: Cache = new Map()) {
  const store = makeStore();
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
  const tree = (children: React.ReactNode) => (
    <Provider store={store}>
      <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false }}>
        {children}
      </SWRConfig>
    </Provider>
  );
  const view = render(tree(ui));
  return {
    ...view,
    rerender: () => act(() => view.rerender(tree(ui))),
    show: (next: React.ReactNode) => act(() => view.rerender(tree(next))),
  };
}

export const WORKSPACE_ID = 'ws-1';

export const group = (overrides: Partial<WorkspaceGroup> & { id: string }): WorkspaceGroup => ({
  name: overrides.id,
  description: null,
  status: 'active',
  system: false,
  roles: [],
  members: [],
  ...overrides,
});

export const ADMINS = group({
  id: 'grp-admins',
  name: 'Form administrators',
  system: true,
  roles: ['form_admin'],
});

export const REVIEWERS = group({
  id: 'grp-reviewers',
  name: 'Form Reviewers',
  roles: ['submission_reviewer'],
});

const role = (roleCode: string, name: string): RoleWithSourceMeta => ({
  roleCode,
  name,
  description: null,
  status: 'active',
  source: 'core',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

export const ROLES = {
  roles: [
    role('form_admin', 'form_admin catalog name'),
    role('submission_reviewer', 'submission_reviewer catalog name'),
    role('form_designer', 'form_designer catalog name'),
  ],
};

/** A server page of `items`, as the list endpoint answers. */
export const groupsPage = (
  items: WorkspaceGroup[],
  page: { offset?: number; limit?: number; total?: number } = {},
): ListWorkspaceGroupsResponse => ({
  items,
  page: { offset: page.offset ?? 0, limit: page.limit ?? 10, total: page.total ?? items.length },
  filters: {},
  sort: 'name:asc',
});
