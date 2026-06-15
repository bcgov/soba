const selectMock = jest.fn();

jest.mock('../../../../src/core/db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

import { listGroupsForIdp } from '../../../../src/core/db/repos/idpGroupRepo';

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
