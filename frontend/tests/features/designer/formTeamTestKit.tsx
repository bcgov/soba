import React, { act } from 'react';
import { vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import type { TeamGroup, TeamMember } from '@/src/types/formTeam';
import type { UserSearchUser } from '@/src/types/userSearch';

/**
 * Access tab test helpers. Tests mock the form team API with `formTeamApiMock`, an in-memory
 * stand-in for the server, so the real hooks read and write through it.
 */

export const GROUPS: TeamGroup[] = [
  { id: 'group-1', name: 'Group 1' },
  { id: 'group-2', name: 'Group 2' },
  { id: 'group-3', name: 'Group 3' },
];

const START: TeamMember[] = [
  {
    id: 'm-orla',
    name: 'Orla Venn',
    email: 'orla.venn@example.gov.bc.ca',
    groups: ['group-1'],
    formOnlyGroups: [],
  },
  {
    id: 'm-dax',
    name: 'Dax Halloran',
    email: 'dax.halloran@example.gov.bc.ca',
    groups: ['group-2'],
    formOnlyGroups: [],
  },
];

/** What the server holds: membership id to member. Users map to `m-<userId>`. */
const server = { team: new Map<string, TeamMember>(), failing: false };

/** The member as the server holds them now. */
export const serverMember = (id: string) => server.team.get(id);

const refuse = () => Promise.reject(new Error('refused'));

/** The API module the hooks call, answering from `server`. */
export const formTeamApiMock = {
  listFormTeam: vi.fn(() => {
    const items = [...server.team.values()].sort((a, b) => a.name.localeCompare(b.name));
    return Promise.resolve({
      items,
      page: { offset: 0, limit: 10, total: items.length },
      filters: {},
    });
  }),
  listFormTeamGroups: vi.fn(() => Promise.resolve({ items: GROUPS })),
  addFormTeamMember: vi.fn(
    async (_token: string, _formId: string, body: { userId: string; groupIds: string[] }) => {
      if (server.failing) return refuse();
      const id = `m-${body.userId}`;
      if (server.team.has(id)) {
        throw new ApiError('already on the team', 409, 'team_member_exists');
      }
      const member = {
        id,
        name: body.userId,
        email: '',
        groups: body.groupIds,
        formOnlyGroups: body.groupIds,
      };
      server.team.set(id, member);
      return member;
    },
  ),
  setFormTeamGroups: vi.fn(
    async (_token: string, _formId: string, membershipId: string, groupIds: string[]) => {
      if (server.failing) return refuse();
      const member = { ...server.team.get(membershipId)!, groups: groupIds };
      server.team.set(membershipId, member);
      return member;
    },
  ),
  removeFormTeamMember: vi.fn(async (_token: string, _formId: string, membershipId: string) => {
    if (server.failing) return refuse();
    server.team.delete(membershipId);
  }),
};

/** Puts the starting team back, with writes that succeed. Call before each test. */
export const resetTeam = () => {
  server.team = new Map(START.map((member) => [member.id, { ...member }]));
  server.failing = false;
};

/** Makes every write fail. */
export const failWrites = () => {
  server.failing = true;
};

/** Renders signed in, with a request cache of its own. */
export const renderWithStore = (ui: React.ReactElement) => {
  const store = makeStore();
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
  return render(
    <Provider store={store}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>
    </Provider>,
  );
};

/** Clicks, then waits for the updates and promises the click set off. */
export const click = (element: HTMLElement) =>
  act(() => {
    fireEvent.click(element);
    return Promise.resolve();
  });

export const clickTestId = (testId: string) => click(screen.getByTestId(testId));

/** A person user search found; `sobaUserId` is set for someone who has signed in before. */
export const foundPerson = (
  subject: string,
  displayName: string,
  sobaUserId: string | null = null,
  guid: string | null = `guid-${subject}`,
): UserSearchUser => ({
  identityProvider: 'azureidir',
  subject,
  guid,
  username: null,
  displayName,
  firstName: null,
  lastName: null,
  email: `${subject}@example.gov.bc.ca`,
  sobaUserId,
  sources: ['user-search-soba'],
});
