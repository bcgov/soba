const selectMock = jest.fn();
const transactionMock = jest.fn();

jest.mock('../../../../src/core/db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
    transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

const getWorkspaceForUserMock = jest.fn();

jest.mock('../../../../src/core/db/repos/membershipRepo', () => ({
  ...jest.requireActual('../../../../src/core/db/repos/membershipRepo'),
  getWorkspaceForUser: (...args: unknown[]) => getWorkspaceForUserMock(...args),
}));

import { createTeamWorkspace, updateWorkspace } from '../../../../src/core/db/repos/workspaceRepo';
import { ConflictError } from '../../../../src/core/errors';
import { WORKSPACE_NAME_TAKEN } from '../../../../src/core/messages';
import { WorkspaceKind, WorkspaceMembershipRole } from '../../../../src/core/db/codes';

/** Chains select().from().where().limit() the way the repo queries, resolving to `rows`. */
function mockSelectResolvesTo(rows: unknown[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const whereMock = jest.fn(() => ({ limit: limitMock }));
  const fromMock = jest.fn(() => ({ where: whereMock }));
  selectMock.mockReturnValueOnce({ from: fromMock });
}

const membership = {
  id: 'workspace-1',
  kind: WorkspaceKind.team,
  name: 'Existing Name',
  org: 'HLTH',
  useCase: 'internal',
  status: 'active',
  membershipId: 'membership-1',
  role: WorkspaceMembershipRole.owner,
  disclaimerAcceptedAt: null,
};

describe('workspaceRepo', () => {
  beforeEach(() => {
    selectMock.mockReset();
    transactionMock.mockReset();
    getWorkspaceForUserMock.mockReset();
  });

  it('createTeamWorkspace throws a conflict when the name is already taken', async () => {
    mockSelectResolvesTo([{ id: 'other-workspace' }]);

    await expect(createTeamWorkspace('user-1', 'Health', 'HLTH', 'internal')).rejects.toThrow(
      new ConflictError(WORKSPACE_NAME_TAKEN),
    );
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('createTeamWorkspace succeeds when the name is available', async () => {
    mockSelectResolvesTo([]); // uniqueness check: free

    await createTeamWorkspace('user-1', 'New Name', 'HLTH', 'internal');

    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function));
  });

  it('updateWorkspace throws a conflict when the new name is already taken', async () => {
    getWorkspaceForUserMock.mockResolvedValue(membership);
    mockSelectResolvesTo([{ displayLabel: 'Actor' }]); // actor display-label lookup
    mockSelectResolvesTo([{ id: 'other-workspace' }]); // uniqueness check: taken

    await expect(updateWorkspace('workspace-1', 'user-1', { name: 'Taken Name' })).rejects.toThrow(
      new ConflictError(WORKSPACE_NAME_TAKEN),
    );
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('updateWorkspace succeeds when the new name is available', async () => {
    getWorkspaceForUserMock.mockResolvedValue(membership);
    mockSelectResolvesTo([{ displayLabel: 'Actor' }]); // actor display-label lookup
    mockSelectResolvesTo([]); // uniqueness check: free

    const setMock = jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) }));
    const updateMock = jest.fn(() => ({ set: setMock }));
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({ update: updateMock });
    });

    await expect(updateWorkspace('workspace-1', 'user-1', { name: 'New Name' })).resolves.toBe(
      true,
    );
    expect(updateMock).toHaveBeenCalled();
  });
});
