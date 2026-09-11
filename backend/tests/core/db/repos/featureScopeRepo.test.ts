const selectMock = jest.fn();

jest.mock('../../../../src/core/db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

import { hasActiveFeatureGrant } from '../../../../src/core/db/repos/featureScopeRepo';

describe('featureScopeRepo.hasActiveFeatureGrant', () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  // Without a scope id there is nothing to match; querying anyway would risk matching an unrelated
  // grant for the same feature, so the guard must short-circuit before touching the DB.
  it('returns false without querying when neither workspace nor form id is supplied', async () => {
    await expect(hasActiveFeatureGrant({ featureCode: 'document-generation-v3' })).resolves.toBe(
      false,
    );
    expect(selectMock).not.toHaveBeenCalled();
  });
});
