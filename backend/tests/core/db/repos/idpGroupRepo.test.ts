const selectMock = jest.fn();

jest.mock('../../../../src/core/db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

import {
  listGroupsForIdp,
  canCreateWorkspaceByIdp,
} from '../../../../src/core/db/repos/idpGroupRepo';

describe('idpGroupRepo.listGroupsForIdp', () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it('returns group codes for an idp, normalizing case/whitespace', async () => {
    const where = jest.fn().mockResolvedValue([{ groupCode: 'bcgov' }]);
    const from = jest.fn().mockReturnValue({ where });
    selectMock.mockReturnValue({ from });

    const groups = await listGroupsForIdp('  AzureIDIR  ');

    expect(groups).toEqual(['bcgov']);
    expect(selectMock).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list (and skips the query) for a blank idp code', async () => {
    const groups = await listGroupsForIdp('   ');

    expect(groups).toEqual([]);
    expect(selectMock).not.toHaveBeenCalled();
  });
});

describe('idpGroupRepo.canCreateWorkspaceByIdp', () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it('returns true when idp belongs to the bcgov group', async () => {
    const where = jest.fn().mockResolvedValue([{ groupCode: 'bcgov' }]);
    const from = jest.fn().mockReturnValue({ where });
    selectMock.mockReturnValue({ from });

    await expect(canCreateWorkspaceByIdp('idir')).resolves.toBe(true);
  });

  it('returns false when idp is not in the bcgov group', async () => {
    const where = jest.fn().mockResolvedValue([{ groupCode: 'bceid' }]);
    const from = jest.fn().mockReturnValue({ where });
    selectMock.mockReturnValue({ from });

    await expect(canCreateWorkspaceByIdp('bceidbusiness')).resolves.toBe(false);
  });
});
