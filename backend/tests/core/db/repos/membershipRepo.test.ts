const selectMock = jest.fn();

jest.mock('../../../../src/core/db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

jest.mock('../../../../src/core/integrations/plugins/PluginRegistry', () => ({
  getCacheAdapter: () => ({
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
  }),
}));

import {
  getWorkspaceForUser,
  getActiveWorkspaceIdsForUser,
  getActiveUserIdsForWorkspace,
  isWorkspaceManageRole,
  actorBelongsToWorkspace,
  listWorkspacesForUser,
} from '../../../../src/core/db/repos/membershipRepo';

function selectChain(result: unknown) {
  const resolved = () => Promise.resolve(result);
  return {
    from: () => ({
      innerJoin: () => ({
        leftJoin: () => ({
          where: () => ({
            orderBy: () => ({ limit: resolved }),
            limit: resolved,
          }),
        }),
      }),
      where: () => ({
        limit: resolved,
      }),
    }),
  };
}

function flatSelectChain(result: unknown) {
  const resolve = () => Promise.resolve(result);
  return {
    from: () => ({
      where: () => ({
        limit: resolve,
        then: (resolve) => Promise.resolve(result).then(resolve),
      }),
    }),
  };
}

function listSelectChain(result: unknown) {
  return {
    from: () => ({
      innerJoin: () => ({
        leftJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve(result),
            }),
          }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  selectMock.mockReset();
});

describe('getWorkspaceForUser', () => {
  it('returns the workspace row when the user is an active member', async () => {
    const row = {
      id: 'ws1',
      kind: 'team',
      name: 'Alpha',
      status: 'active',
      membershipId: 'mem1',
      role: 'owner',
      disclaimerAcceptedAt: null,
      updatedAt: new Date(),
    };
    selectMock.mockReturnValue(selectChain([row]));

    const result = await getWorkspaceForUser('ws1', 'user1');

    expect(result).toEqual(row);
  });

  it('returns null when the user is not a member', async () => {
    selectMock.mockReturnValue(selectChain([]));

    const result = await getWorkspaceForUser('ws1', 'user1');

    expect(result).toBeNull();
  });
});

describe('actorBelongsToWorkspace', () => {
  it('returns true when an active membership exists', async () => {
    selectMock.mockReturnValue(flatSelectChain([{ id: 'mem1' }]));

    const result = await actorBelongsToWorkspace('ws1', 'user1');

    expect(result).toBe(true);
  });

  it('returns false when no active membership exists', async () => {
    selectMock.mockReturnValue(flatSelectChain([]));

    const result = await actorBelongsToWorkspace('ws1', 'user1');

    expect(result).toBe(false);
  });
});

describe('getActiveWorkspaceIdsForUser', () => {
  it('returns workspace ids the user belongs to', async () => {
    selectMock.mockReturnValue(flatSelectChain([{ workspaceId: 'ws1' }, { workspaceId: 'ws2' }]));

    const result = await getActiveWorkspaceIdsForUser('user1');

    expect(result).toEqual(['ws1', 'ws2']);
  });

  it('returns an empty array when the user has no workspaces', async () => {
    selectMock.mockReturnValue(flatSelectChain([]));

    const result = await getActiveWorkspaceIdsForUser('user1');

    expect(result).toEqual([]);
  });
});

describe('getActiveUserIdsForWorkspace', () => {
  it('returns user ids for active members of a workspace', async () => {
    selectMock.mockReturnValue(
      flatSelectChain([{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }]),
    );

    const result = await getActiveUserIdsForWorkspace('ws1');

    expect(result).toEqual(['u1', 'u2', 'u3']);
  });

  it('returns an empty array when the workspace has no active members', async () => {
    selectMock.mockReturnValue(flatSelectChain([]));

    const result = await getActiveUserIdsForWorkspace('ws1');

    expect(result).toEqual([]);
  });
});

describe('isWorkspaceManageRole', () => {
  it('returns true for owner', () => {
    expect(isWorkspaceManageRole('owner')).toBe(true);
  });

  it('returns true for admin', () => {
    expect(isWorkspaceManageRole('admin')).toBe(true);
  });

  it('returns false for member', () => {
    expect(isWorkspaceManageRole('member')).toBe(false);
  });

  it('returns false for viewer', () => {
    expect(isWorkspaceManageRole('viewer')).toBe(false);
  });

  it('returns false for an unknown role', () => {
    expect(isWorkspaceManageRole('guest')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isWorkspaceManageRole('')).toBe(false);
  });
});

describe('listWorkspacesForUser', () => {
  beforeEach(() => {
    selectMock.mockReturnValue(listSelectChain([]));
  });

  it('returns items and hasMore=false when results fit within limit', async () => {
    const rows = [
      {
        id: 'ws1',
        name: 'Alpha',
        kind: 'team',
        role: 'owner',
        status: 'active',
        disclaimerAcceptedAt: null,
        updatedAt: new Date(),
      },
      {
        id: 'ws2',
        name: 'Beta',
        kind: 'team',
        role: 'member',
        status: 'active',
        disclaimerAcceptedAt: null,
        updatedAt: new Date(),
      },
    ];
    selectMock.mockReturnValue(listSelectChain(rows));

    const result = await listWorkspacesForUser({
      userId: 'user1',
      limit: 10,
      sort: 'updatedAt:desc',
      cursorMode: 'id',
    });

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it('returns hasMore=true when results exceed limit', async () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      id: `ws${i}`,
      name: `Workspace ${i}`,
      kind: 'team',
      role: 'member',
      status: 'active',
      disclaimerAcceptedAt: null,
      updatedAt: new Date(),
    }));
    selectMock.mockReturnValue(listSelectChain(rows));

    const result = await listWorkspacesForUser({
      userId: 'user1',
      limit: 10,
      sort: 'updatedAt:desc',
      cursorMode: 'id',
    });

    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(true);
  });

  it('returns empty result when user has no workspaces', async () => {
    const result = await listWorkspacesForUser({
      userId: 'user1',
      limit: 10,
      sort: 'updatedAt:desc',
      cursorMode: 'id',
    });

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });
});
