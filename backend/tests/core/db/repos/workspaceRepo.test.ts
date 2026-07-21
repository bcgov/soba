const selectMock = jest.fn();
const insertMock = jest.fn();
const updateMock = jest.fn();
const deleteMock = jest.fn();
const transactionMock = jest.fn();
const executeMock = jest.fn();

jest.mock('../../../../src/core/db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
    insert: (...args: unknown[]) => insertMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    transaction: (...args: unknown[]) => transactionMock(...args),
    execute: (...args: unknown[]) => executeMock(...args),
  },
}));

jest.mock('../../../../src/core/db/repos/membershipRepo', () => ({
  getWorkspaceForUser: jest.fn(),
  isWorkspaceManageRole: jest.fn(),
  invalidateMembershipCache: jest.fn(),
}));

jest.mock('../../../../src/core/db/repos/workspaceGroupRepo', () => ({
  createGroupWithRole: jest.fn().mockResolvedValue('group-1'),
  addUserToGroup: jest.fn().mockResolvedValue(undefined),
  addIdpToGroup: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../src/core/db/repos/identityProviderRepo', () => ({
  getIdentityProvider: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../../src/core/config/env', () => ({
  env: {
    getDefaultSubmitterProvider: jest.fn().mockReturnValue('keycloak'),
  },
}));

jest.mock('uuid', () => ({
  v7: jest.fn(() => 'generated-uuid'),
}));

import { getWorkspaceById, updateWorkspace } from '../../../../src/core/db/repos/workspaceRepo';
import {
  getWorkspaceForUser,
  isWorkspaceManageRole,
} from '../../../../src/core/db/repos/membershipRepo';

function selectChain(result: unknown) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(result),
      }),
    }),
  };
}

beforeEach(() => {
  selectMock.mockReset();
  insertMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  transactionMock.mockReset();
  executeMock.mockReset();
  jest.mocked(getWorkspaceForUser).mockReset();
  jest.mocked(isWorkspaceManageRole).mockReset();
});

describe('getWorkspaceById', () => {
  it('returns the workspace id when it exists', async () => {
    selectMock.mockReturnValue(selectChain([{ id: 'ws1' }]));

    const result = await getWorkspaceById('ws1');

    expect(result).toEqual({ id: 'ws1' });
  });

  it('returns null when the workspace does not exist', async () => {
    selectMock.mockReturnValue(selectChain([]));

    const result = await getWorkspaceById('missing');

    expect(result).toBeNull();
  });
});

describe('updateWorkspace', () => {
  it('returns false when the actor is not a member', async () => {
    jest.mocked(getWorkspaceForUser).mockResolvedValue(null);

    const result = await updateWorkspace('ws1', 'user1', { name: 'New Name' });

    expect(result).toBe(false);
  });

  it('returns false when the actor has a non-manage role', async () => {
    jest.mocked(getWorkspaceForUser).mockResolvedValue({
      id: 'ws1',
      kind: 'team',
      name: 'Workspace',
      status: 'active',
      membershipId: 'mem1',
      role: 'member',
      disclaimerAcceptedAt: null,
      updatedAt: new Date(),
    });
    jest.mocked(isWorkspaceManageRole).mockReturnValue(false);

    const result = await updateWorkspace('ws1', 'user1', { name: 'New Name' });

    expect(result).toBe(false);
  });

  it('returns true and updates name when actor can manage', async () => {
    jest.mocked(getWorkspaceForUser).mockResolvedValue({
      id: 'ws1',
      kind: 'team',
      name: 'Old Name',
      status: 'active',
      membershipId: 'mem1',
      role: 'admin',
      disclaimerAcceptedAt: null,
      updatedAt: new Date(),
    });
    jest.mocked(isWorkspaceManageRole).mockReturnValue(true);

    // First select: appUsers lookup for displayLabel
    // Second select: workspaceNameExistsForKind check (must be empty = no conflict)
    selectMock
      .mockReturnValueOnce(selectChain([{ displayLabel: 'Admin User' }]))
      .mockReturnValueOnce(selectChain([]));
    transactionMock.mockImplementation(async (fn) => {
      const tx = {
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      return fn(tx);
    });

    const result = await updateWorkspace('ws1', 'user1', { name: 'New Name' });

    expect(result).toBe(true);
    expect(transactionMock).toHaveBeenCalled();
  });

  it('returns true when updating disclaimerAccepted', async () => {
    jest.mocked(getWorkspaceForUser).mockResolvedValue({
      id: 'ws1',
      kind: 'team',
      name: 'Workspace',
      status: 'active',
      membershipId: 'mem1',
      role: 'owner',
      disclaimerAcceptedAt: null,
      updatedAt: new Date(),
    });
    jest.mocked(isWorkspaceManageRole).mockReturnValue(true);

    selectMock.mockReturnValue(selectChain([{ displayLabel: null }]));
    transactionMock.mockImplementation(async (fn) => {
      const tx = {
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      };
      return fn(tx);
    });

    const result = await updateWorkspace('ws1', 'user1', { disclaimerAccepted: true });

    expect(result).toBe(true);
  });
});
